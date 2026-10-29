"""客户端通知路由：规则 config、系统通知列表与详情、已读同步。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from common.deps import get_current_user, get_lang
from common.i18n import resolve_lang, t
from common.response import build_page_info, resp_success
from core.database import get_db
from models.user import User
from schemas.notification import NotificationReadRequest
from service.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["通知"])


@router.get(
    "/config",
    summary="客户端-通知规则与有效临时通知",
    description=(
        "公开只读：返回规则包（策略默认已种子化）以及当前有效的临时通知。"
        "客户端按规则执行 L1/L2/频控/静默；临时通知需再按本地开关与权限过滤。\n\n"
        "**出参 result**\n"
        "- rules: 规则 JSON\n"
        "- updated_at: 规则最近更新时间\n"
        "- campaigns: 当前有效临时通知数组"
        "（id / title / body / channel / platforms / start_at / end_at / bypass_quiet）"
    ),
    openapi_extra={"security": []},
)
def get_notification_config(request: Request, db: Session = Depends(get_db)):
    """返回客户端通知规则与当前有效活动。"""

    lang = resolve_lang(request=request)
    svc = NotificationService(db)
    rules_pack = svc.get_rules(lang=lang)
    campaigns = svc.list_active_campaigns_public()
    return resp_success(
        result={
            "rules": rules_pack.get("rules"),
            "updated_at": rules_pack.get("updated_at"),
            "campaigns": campaigns,
        },
        message=t("ok", lang=lang),
    )


@router.get(
    "",
    summary="用户-系统通知列表",
    description=(
        "登录用户查询系统通知（后台 campaign，默认 channel=system）。支持平台过滤与分页。\n\n"
        "**入参**（Query）\n"
        "- pageNum / pageSize: 分页\n"
        "- platform: ios|android|web|pc；system 频道忽略平台（账号内多端一致）；"
        "promo 仍按平台过滤；空=不限制\n"
        "- channel: system|promo|all（默认 system）\n\n"
        "**出参 result**\n"
        "- items: 通知数组"
        "（id / title / body / channel / status / platforms / start_at / end_at /"
        " published_at / created_at / bypass_quiet / is_read）\n"
        "并携带 pageInfo。"
    ),
)
def list_notifications(
    request: Request,
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    platform: str = Query("", description="ios|android|web|pc，空=全部平台可见项"),
    channel: str = Query("system", description="system|promo|all"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """分页返回当前用户可见的系统通知。"""

    lang = get_lang(request)
    items, total = NotificationService(db).list_inbox(
        pageNum,
        pageSize,
        platform=platform,
        channel=channel,
        user_id=user.id,
    )
    return resp_success(
        result={"items": items},
        message=t("ok", lang=lang),
        page_info=build_page_info(pageNum, pageSize, total),
    )


@router.put(
    "/reads",
    summary="用户-更新通知已读状态",
    description=(
        "批量 upsert 通知已读资源（跨设备同步）；幂等。需 Bearer Token。\n\n"
        "**入参**\n"
        "- ids: 已读 campaign id 列表（最多 200）\n\n"
        "**出参 result**\n"
        "- ids: 本次涉及且已读的 id 列表\n"
        "- marked: 新标记条数"
    ),
)
def put_notification_reads(
    body: NotificationReadRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lang = get_lang(request)
    result = NotificationService(db).mark_read(user.id, body.ids)
    return resp_success(result=result, message=t("ok", lang=lang))


@router.get(
    "/{notification_id}",
    summary="用户-系统通知详情",
    description=(
        "返回指定且对当前平台可见的通知详情。需 Bearer Token。\n\n"
        "**入参**\n"
        "- notification_id: 路径参数，campaign id\n"
        "- platform: Query，ios|android|web|pc（可选）\n\n"
        "**出参 result**\n"
        "- id / title / body / channel / status / platforms\n"
        "- start_at / end_at / published_at / created_at / bypass_quiet / is_read"
    ),
)
def get_notification(
    notification_id: int,
    request: Request,
    platform: str = Query(""),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回指定且对当前平台可见的通知详情。"""

    lang = get_lang(request)
    item = NotificationService(db).get_inbox_item(
        notification_id, platform=platform, user_id=user.id
    )
    return resp_success(result=item, message=t("ok", lang=lang))
