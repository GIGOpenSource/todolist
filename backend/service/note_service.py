"""笔记业务：清单查询、分页与按周增量同步（条目 updated_at LWW + is_deleted）。"""

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
from models.note import Note
from models.sync_meta import SyncMeta
from models.user import User
from schemas.note import NoteItem, NoteSyncResult

logger = get_logger("note_service")

WEEK_MS = 7 * 24 * 60 * 60 * 1000
_NOTE_ID_UID_SEQ = re.compile(r"^n(\d+)_(\d+)$")


def assert_note_id_belongs_to_user(user_id: int, note_id: str) -> None:
    """Reject uid-prefixed ids that claim another user's namespace."""
    m = _NOTE_ID_UID_SEQ.match((note_id or "").strip())
    if not m:
        return
    if int(m.group(1)) != int(user_id):
        raise AppError(CODE_FORBIDDEN, "note.id_conflict")


class NoteService:
    """用户维度的笔记读写与云端同步。"""

    def __init__(self, db: Session):
        self.db = db

    def _get_or_create_sync_meta(self, user_id: int) -> SyncMeta:
        meta = self.db.get(SyncMeta, user_id)
        if meta is None:
            meta = SyncMeta(user_id=user_id, list_updated_at=0.0, notes_list_updated_at=0.0)
            self.db.add(meta)
            self.db.commit()
            self.db.refresh(meta)
        return meta

    def _notes_to_items(self, notes: List[Note]) -> List[NoteItem]:
        return [
            NoteItem(
                id=n.id,
                title=n.title,
                content=getattr(n, "content", None) or "",
                is_deleted=bool(getattr(n, "is_deleted", False)),
                created_at=n.created_at,
                updated_at=n.updated_at,
            )
            for n in sorted(notes, key=lambda x: x.created_at)
        ]

    def _apply_deleted_ids(self, user: User, deleted_ids: List[str], now_ms: float) -> None:
        if not deleted_ids:
            return
        for note_id in deleted_ids:
            assert_note_id_belongs_to_user(user.id, note_id)

        owned = {
            n.id: n
            for n in self.db.query(Note)
            .filter(Note.user_id == user.id, Note.id.in_(deleted_ids))
            .all()
        }
        for note_id in deleted_ids:
            row = owned.get(note_id)
            if row is None:
                self.db.add(
                    Note(
                        id=note_id,
                        user_id=user.id,
                        title="",
                        content="",
                        is_deleted=True,
                        created_at=now_ms,
                        updated_at=now_ms,
                    )
                )
                continue
            row.is_deleted = True
            row.updated_at = max(float(row.updated_at or 0), now_ms)

    def _batch_upsert(self, user: User, items: List[NoteItem]) -> None:
        if not items:
            return

        for item in items:
            assert_note_id_belongs_to_user(user.id, item.id)

        ids = [i.id for i in items]
        owned = {
            n.id: n
            for n in self.db.query(Note)
            .filter(Note.user_id == user.id, Note.id.in_(ids))
            .all()
        }
        conflict = (
            self.db.query(Note.id)
            .filter(Note.id.in_(ids), Note.user_id != user.id)
            .first()
        )
        if conflict is not None:
            logger.warning(
                "note id conflict id=%s requester=%s",
                conflict[0],
                user.id,
            )
            raise AppError(CODE_FORBIDDEN, "note.id_conflict")

        for item in items:
            incoming_ts = float(item.updated_at or 0)
            existing = owned.get(item.id)
            if existing is None:
                self.db.add(
                    Note(
                        id=item.id,
                        user_id=user.id,
                        title=item.title,
                        content=item.content or "",
                        is_deleted=bool(item.is_deleted),
                        created_at=item.created_at,
                        updated_at=incoming_ts,
                    )
                )
                continue
            if incoming_ts >= float(existing.updated_at or 0):
                existing.title = item.title
                existing.content = item.content or ""
                existing.is_deleted = bool(item.is_deleted)
                existing.created_at = item.created_at
                existing.updated_at = incoming_ts

    def cloud_count(self, user: User) -> int:
        return (
            self.db.query(func.count(Note.id))
            .filter(Note.user_id == user.id, Note.is_deleted.is_(False))
            .scalar()
            or 0
        )

    def get_notes(self, user: User) -> Tuple[NoteSyncResult, str]:
        meta = self._get_or_create_sync_meta(user.id)
        notes = (
            self.db.query(Note)
            .filter(Note.user_id == user.id, Note.is_deleted.is_(False))
            .all()
        )
        items = self._notes_to_items(notes)
        result = NoteSyncResult(
            notes=items,
            list_updated_at=float(getattr(meta, "notes_list_updated_at", None) or 0),
            source="server",
            cloud_count=len(items),
            has_more=False,
            sync_weeks=0,
        )
        logger.info("get notes user_id=%s count=%s", user.id, len(items))
        return result, "note.fetch.success"

    def list_notes_paged(self, user: User, page_num: int, page_size: int) -> Tuple[List[NoteItem], int]:
        query = (
            self.db.query(Note)
            .filter(Note.user_id == user.id, Note.is_deleted.is_(False))
            .order_by(Note.created_at.asc())
        )
        total = query.count()
        offset = (page_num - 1) * page_size
        rows = query.offset(offset).limit(page_size).all()
        return self._notes_to_items(rows), total

    def sync(
        self,
        user: User,
        items: List[NoteItem],
        client_ts: float,
        deleted_ids: Optional[List[str]] = None,
        sync_weeks: int = 1,
        dirty_only: bool = False,
    ) -> Tuple[NoteSyncResult, str]:
        weeks = max(1, int(sync_weeks or 1))
        deleted_ids = [d for d in (deleted_ids or []) if d]
        items = list(items or [])

        from service.login_day import record_login_day

        record_login_day(self.db, user.id)

        if len(items) > MAX_SYNC_TODOS:
            raise AppError(CODE_PAYLOAD_TOO_LARGE, "note.sync.payload_too_large")
        if len(deleted_ids) > MAX_SYNC_DELETED_IDS:
            raise AppError(CODE_PAYLOAD_TOO_LARGE, "note.sync.payload_too_large")

        meta = self._get_or_create_sync_meta(user.id)
        server_ts = float(getattr(meta, "notes_list_updated_at", None) or 0)
        client_ts = float(client_ts or 0)

        now_ms = max(time.time() * 1000, client_ts)
        since = now_ms - weeks * WEEK_MS
        t0 = time.perf_counter()

        logger.info(
            "note sync start user_id=%s client_ts=%s server_ts=%s client_count=%s deleted=%s weeks=%s dirty_only=%s",
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
            meta.notes_list_updated_at = final_ts
            self.db.commit()
        else:
            final_ts = server_ts

        window_rows = (
            self.db.query(Note)
            .filter(
                Note.user_id == user.id,
                or_(Note.created_at >= since, Note.updated_at >= since),
            )
            .all()
        )
        has_more = (
            self.db.query(Note.id)
            .filter(
                Note.user_id == user.id,
                Note.is_deleted.is_(False),
                Note.created_at < since,
            )
            .limit(1)
            .first()
            is not None
        )
        cloud_count = self.cloud_count(user)

        result = NoteSyncResult(
            notes=self._notes_to_items(window_rows),
            list_updated_at=final_ts,
            source="merged",
            cloud_count=cloud_count,
            has_more=has_more,
            sync_weeks=weeks,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000
        deleted_in_window = sum(1 for n in result.notes if n.is_deleted)
        logger.info(
            "note sync done user_id=%s window=%s deleted_in_window=%s cloud=%s has_more=%s weeks=%s wrote=%s elapsed_ms=%.2f",
            user.id,
            len(result.notes),
            deleted_in_window,
            cloud_count,
            has_more,
            weeks,
            wrote,
            elapsed_ms,
        )
        if elapsed_ms >= 300:
            logger.warning(
                "slow note sync user_id=%s elapsed_ms=%.2f items=%s",
                user.id,
                elapsed_ms,
                len(items),
            )
        return result, "note.sync.weekly"
