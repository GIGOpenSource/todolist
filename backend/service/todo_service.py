"""待办业务：清单查询、分页与按周增量同步（条目 updated_at LWW + is_deleted）。"""

from __future__ import annotations

import re
import time
from typing import List, Optional, Tuple

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from common.constants import (
    CODE_FORBIDDEN,
    CODE_PAYLOAD_TOO_LARGE,
    MAX_SYNC_DELETED_IDS,
    MAX_SYNC_TODOS,
)
from common.exceptions import AppError
from common.logger import get_logger
from models.sync_meta import SyncMeta
from models.todo import Todo
from models.user import User
from schemas.todo import SyncResult, TodoItem

logger = get_logger("todo_service")

WEEK_MS = 7 * 24 * 60 * 60 * 1000
# Client convention: u{user_id}_{seq} e.g. u12_3
_TODO_ID_UID_SEQ = re.compile(r"^u(\d+)_(\d+)$")


def assert_todo_id_belongs_to_user(user_id: int, todo_id: str) -> None:
    """Reject uid-prefixed ids that claim another user's namespace."""
    m = _TODO_ID_UID_SEQ.match((todo_id or "").strip())
    if not m:
        return
    if int(m.group(1)) != int(user_id):
        raise AppError(CODE_FORBIDDEN, "todo.id_conflict")


class TodoService:
    """用户维度的待办读写与云端同步。"""

    def __init__(self, db: Session):
        self.db = db

    def _get_or_create_sync_meta(self, user_id: int) -> SyncMeta:
        """获取或创建用户级同步元数据（含 list_updated_at）。"""
        meta = self.db.get(SyncMeta, user_id)
        if meta is None:
            meta = SyncMeta(user_id=user_id, list_updated_at=0.0)
            self.db.add(meta)
            self.db.commit()
            self.db.refresh(meta)
        return meta

    def _todos_to_items(self, todos: List[Todo]) -> List[TodoItem]:
        return [
            TodoItem(
                id=t.id,
                title=t.title,
                detail=getattr(t, "detail", None) or "",
                due_at=float(getattr(t, "due_at", None) or 0),
                completed=bool(t.completed),
                is_deleted=bool(getattr(t, "is_deleted", False)),
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
            for t in sorted(todos, key=lambda x: x.created_at)
        ]

    def _apply_deleted_ids(self, user: User, deleted_ids: List[str], now_ms: float) -> None:
        """兼容 deleted_ids：软删除并刷新 updated_at（不硬删，避免对端 upsert 复活）。"""
        if not deleted_ids:
            return
        for todo_id in deleted_ids:
            assert_todo_id_belongs_to_user(user.id, todo_id)

        owned = {
            t.id: t
            for t in self.db.query(Todo)
            .filter(Todo.user_id == user.id, Todo.id.in_(deleted_ids))
            .all()
        }
        for todo_id in deleted_ids:
            row = owned.get(todo_id)
            if row is None:
                # 本地已删且云端无行：写入软删除占位，阻止其它端旧副本复活
                self.db.add(
                    Todo(
                        id=todo_id,
                        user_id=user.id,
                        title="",
                        detail="",
                        due_at=0.0,
                        completed=False,
                        is_deleted=True,
                        created_at=now_ms,
                        updated_at=now_ms,
                    )
                )
                continue
            row.is_deleted = True
            row.updated_at = max(float(row.updated_at or 0), now_ms)

    def _batch_upsert(self, user: User, items: List[TodoItem]) -> None:
        """按 updated_at 做 LWW；本地新覆盖线上旧，线上新覆盖本地旧（含 is_deleted）。"""
        if not items:
            return

        for item in items:
            assert_todo_id_belongs_to_user(user.id, item.id)

        ids = [i.id for i in items]
        owned = {
            t.id: t
            for t in self.db.query(Todo)
            .filter(Todo.user_id == user.id, Todo.id.in_(ids))
            .all()
        }
        conflict = (
            self.db.query(Todo.id)
            .filter(Todo.id.in_(ids), Todo.user_id != user.id)
            .first()
        )
        if conflict is not None:
            logger.warning(
                "todo id conflict id=%s requester=%s",
                conflict[0],
                user.id,
            )
            raise AppError(CODE_FORBIDDEN, "todo.id_conflict")

        for item in items:
            incoming_ts = float(item.updated_at or 0)
            existing = owned.get(item.id)
            if existing is None:
                self.db.add(
                    Todo(
                        id=item.id,
                        user_id=user.id,
                        title=item.title,
                        detail=item.detail or "",
                        due_at=float(item.due_at or 0),
                        completed=bool(item.completed),
                        is_deleted=bool(item.is_deleted),
                        created_at=item.created_at,
                        updated_at=incoming_ts,
                    )
                )
                continue
            if incoming_ts >= float(existing.updated_at or 0):
                existing.title = item.title
                existing.detail = item.detail or ""
                existing.due_at = float(item.due_at or 0)
                existing.completed = bool(item.completed)
                existing.is_deleted = bool(item.is_deleted)
                existing.created_at = item.created_at
                existing.updated_at = incoming_ts

    def cloud_count(self, user: User) -> int:
        """统计用户云端未删除待办总数。"""

        return (
            self.db.query(func.count(Todo.id))
            .filter(Todo.user_id == user.id, Todo.is_deleted.is_(False))
            .scalar()
            or 0
        )

    def get_todos(self, user: User) -> Tuple[SyncResult, str]:
        """返回用户完整云端清单（仅未删除）及同步元数据。"""

        meta = self._get_or_create_sync_meta(user.id)
        todos = (
            self.db.query(Todo)
            .filter(Todo.user_id == user.id, Todo.is_deleted.is_(False))
            .all()
        )
        items = self._todos_to_items(todos)
        result = SyncResult(
            todos=items,
            list_updated_at=float(meta.list_updated_at or 0),
            source="server",
            cloud_count=len(items),
            has_more=False,
            sync_weeks=0,
        )
        logger.info("get todos user_id=%s count=%s", user.id, len(items))
        return result, "todo.fetch.success"

    def list_todos_paged(self, user: User, page_num: int, page_size: int) -> Tuple[List[TodoItem], int]:
        """按创建时间分页查询用户未删除待办。"""

        query = (
            self.db.query(Todo)
            .filter(Todo.user_id == user.id, Todo.is_deleted.is_(False))
            .order_by(Todo.created_at.asc())
        )
        total = query.count()
        offset = (page_num - 1) * page_size
        rows = query.offset(offset).limit(page_size).all()
        return self._todos_to_items(rows), total

    def sync(
        self,
        user: User,
        items: List[TodoItem],
        client_ts: float,
        deleted_ids: Optional[List[str]] = None,
        sync_weeks: int = 1,
        dirty_only: bool = False,
    ) -> Tuple[SyncResult, str]:
        """按周时间窗增量同步。

        1. deleted_ids → 软删除（is_deleted=true，刷新 updated_at）
        2. 条目按 updated_at LWW upsert（含 is_deleted）
        3. 返回时间窗内条目（含软删除），客户端按 is_deleted 清理本地缓存
        """
        weeks = max(1, int(sync_weeks or 1))
        deleted_ids = [d for d in (deleted_ids or []) if d]
        items = list(items or [])

        from service.login_day import record_login_day

        record_login_day(self.db, user.id)

        if len(items) > MAX_SYNC_TODOS:
            raise AppError(CODE_PAYLOAD_TOO_LARGE, "todo.sync.payload_too_large")
        if len(deleted_ids) > MAX_SYNC_DELETED_IDS:
            raise AppError(CODE_PAYLOAD_TOO_LARGE, "todo.sync.payload_too_large")

        meta = self._get_or_create_sync_meta(user.id)
        server_ts = float(meta.list_updated_at or 0)
        client_ts = float(client_ts or 0)

        now_ms = max(time.time() * 1000, client_ts)
        since = now_ms - weeks * WEEK_MS
        t0 = time.perf_counter()

        logger.info(
            "sync start user_id=%s client_ts=%s server_ts=%s client_count=%s deleted=%s weeks=%s dirty_only=%s",
            user.id,
            client_ts,
            server_ts,
            len(items),
            len(deleted_ids),
            weeks,
            dirty_only,
        )

        wrote = False
        if deleted_ids:
            self._apply_deleted_ids(user, deleted_ids, now_ms)
            wrote = True

        if items:
            self._batch_upsert(user, items)
            wrote = True

        if wrote:
            final_ts = max(server_ts, client_ts, now_ms)
            meta.list_updated_at = final_ts
            self.db.commit()
        else:
            final_ts = server_ts

        window_rows = (
            self.db.query(Todo)
            .filter(
                Todo.user_id == user.id,
                or_(Todo.created_at >= since, Todo.updated_at >= since),
            )
            .all()
        )
        has_more = (
            self.db.query(Todo.id)
            .filter(
                Todo.user_id == user.id,
                Todo.is_deleted.is_(False),
                Todo.created_at < since,
            )
            .limit(1)
            .first()
            is not None
        )
        cloud_count = self.cloud_count(user)

        result = SyncResult(
            todos=self._todos_to_items(window_rows),
            list_updated_at=final_ts,
            source="merged",
            cloud_count=cloud_count,
            has_more=has_more,
            sync_weeks=weeks,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000
        deleted_in_window = sum(1 for t in result.todos if t.is_deleted)
        logger.info(
            "sync done user_id=%s window=%s deleted_in_window=%s cloud=%s has_more=%s weeks=%s wrote=%s elapsed_ms=%.2f",
            user.id,
            len(result.todos),
            deleted_in_window,
            cloud_count,
            has_more,
            weeks,
            wrote,
            elapsed_ms,
        )
        if elapsed_ms >= 300:
            logger.warning(
                "slow sync user_id=%s elapsed_ms=%.2f items=%s",
                user.id,
                elapsed_ms,
                len(items),
            )
        return result, "todo.sync.weekly"
