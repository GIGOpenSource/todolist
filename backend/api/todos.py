"""待办路由：云端清单、分页与 PUT /sync 增量同步。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from common.deps import get_current_user, get_lang
from common.i18n import t
from common.logger import get_logger
from common.rate_limit import rate_limit, user_rate_key
from common.response import build_page_info, resp_success
from core.database import get_db
from models.user import User
from schemas.todo import SyncRequest
from service.todo_service import TodoService
from settings.config import get_settings

logger = get_logger("api.todos")
router = APIRouter(prefix="/todos", tags=["待办"])


@router.get(
    "",
    summary="获取当前用户云端待办",
    description=(
        "获取当前登录用户的完整云端待办清单（非分页）。\n\n"
        "**鉴权**：Bearer Token 必填。\n\n"
        "**出参 result**\n"
        "- todos: 待办数组（id/title/detail/due_at/completed/created_at/updated_at）\n"
        "- list_updated_at: 清单级时间戳\n"
        "- source: server"
    ),
)
def get_todos(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回当前用户的完整云端待办清单。"""

    lang = get_lang(request)
    result, msg_key = TodoService(db).get_todos(user)
    return resp_success(result=result.model_dump(), message=t(msg_key, lang=lang))


@router.get(
    "/page",
    summary="分页查询当前用户待办",
    description=(
        "分页查询当前用户待办。\n\n"
        "**鉴权**：Bearer Token 必填。\n\n"
        "**Query**\n"
        "- pageNum: 页码，从 1 开始\n"
        "- pageSize: 每页条数\n\n"
        "**出参**：result 为数组，并携带固定 pageInfo。"
    ),
)
def page_todos(
    request: Request,
    pageNum: int = Query(1, ge=1, description="页码，从 1 开始"),
    pageSize: int = Query(10, ge=1, le=200, description="每页条数"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """分页返回当前用户的云端待办。"""

    lang = get_lang(request)
    items, total = TodoService(db).list_todos_paged(user, pageNum, pageSize)
    page_info = build_page_info(pageNum, pageSize, total)
    logger.info(
        "page todos user_id=%s pageNum=%s pageSize=%s total=%s",
        user.id,
        pageNum,
        pageSize,
        total,
    )
    return resp_success(
        result=[i.model_dump() for i in items],
        message=t("todo.fetch.success", lang=lang),
        page_info=page_info,
    )


@router.put(
    "/sync",
    summary="按周增量同步待办",
    description=(
        "按周时间窗增量同步：每次扩大一周历史窗口。\n\n"
        "**鉴权**：Bearer Token 必填。\n\n"
        "**同步规则**\n"
        "1. deleted_ids → 软删除（is_deleted=true，刷新 updated_at；不硬删）\n"
        "2. 按条目 updated_at 做 LWW upsert（含 is_deleted；新覆盖旧）\n"
        "3. 返回最近 sync_weeks 周内云端任务（含软删除项，客户端据此清理本地）\n"
        "4. has_more 表示是否还有更早云端数据\n\n"
        "**入参**\n"
        "- todos（可含 is_deleted）/ list_updated_at / deleted_ids / sync_weeks / client_hint?\n\n"
        "**出参 result**\n"
        "- todos（可含 is_deleted）/ list_updated_at / source / cloud_count / has_more / sync_weeks"
    ),
)
def sync_todos(
    body: SyncRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """按 deleted_ids 删除后执行 LWW 合并并返回周时间窗数据。"""

    lang = get_lang(request)
    settings = get_settings()
    rate_limit(
        user_rate_key("sync", user.id, request),
        settings.rate_limit_sync_per_minute,
    )
    dirty_only = bool(body.client_hint.dirty_only) if body.client_hint else False
    result, msg_key = TodoService(db).sync(
        user,
        body.todos,
        body.list_updated_at,
        deleted_ids=body.deleted_ids,
        sync_weeks=body.sync_weeks,
        dirty_only=dirty_only,
    )
    return resp_success(result=result.model_dump(), message=t(msg_key, lang=lang))
