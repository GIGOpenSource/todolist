"""管理端通知路由：规则包与临时 campaign CRUD。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from common.deps import get_lang, require_admin_perm
from common.i18n import t
from common.logger import get_logger
from common.permissions import PERM_NOTIFICATIONS
from common.response import build_page_info, resp_success
from core.database import get_db
from models.user import User
from schemas.notification import (
    NotificationCampaignCreate,
    NotificationCampaignUpdate,
    NotificationRulesUpdate,
)
from service.notification_service import NotificationService

logger = get_logger("api.admin_notifications")
router = APIRouter(prefix="/admin/notifications", tags=["管理端-通知"])


@router.get(
    "/rules",
    summary="管理端-通知规则配置",
    description=(
        "返回对齐 mobile-notification-strategy 的规则包（含场景、渠道、频控、静默）。"
        "需管理员权限 notifications。\n\n"
        "**出参 result**\n"
        "- rules: 规则 JSON（场景/渠道/频控/静默等）\n"
        "- updated_at: 最近更新时间 ISO"
    ),
)
def get_rules(
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_NOTIFICATIONS)),
    db: Session = Depends(get_db),
):
    """返回当前通知策略规则包。"""

    lang = get_lang(request)
    result = NotificationService(db).get_rules(lang=lang)
    return resp_success(result=result, message=t("ok", lang=lang))


@router.put(
    "/rules",
    summary="管理端-更新通知规则",
    description=(
        "深度合并并保存通知策略规则。需管理员权限 notifications。\n\n"
        "**入参**（均可选）\n"
        "- rules: 部分规则 JSON，合并到当前配置\n"
        "- enabled: 顶层开关（亦可写在 rules 内）\n\n"
        "**出参 result**\n"
        "- rules / updated_at"
    ),
)
def update_rules(
    body: NotificationRulesUpdate,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_NOTIFICATIONS)),
    db: Session = Depends(get_db),
):
    """合并并保存通知策略规则。"""

    lang = get_lang(request)
    result = NotificationService(db).update_rules(body, lang=lang)
    logger.info("admin update notif rules actor=%s", admin.id)
    return resp_success(result=result, message=t("admin.notif.rules_updated", lang=lang))


@router.delete(
    "/rules",
    summary="管理端-重置通知规则为策略默认",
    description=(
        "删除当前自定义规则并恢复为系统默认策略包。需管理员权限 notifications。\n\n"
        "**出参 result**\n"
        "- rules / updated_at"
    ),
)
def reset_rules(
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_NOTIFICATIONS)),
    db: Session = Depends(get_db),
):
    """将通知策略恢复为系统默认值。"""

    lang = get_lang(request)
    result = NotificationService(db).reset_rules(lang=lang)
    logger.info("admin reset notif rules actor=%s", admin.id)
    return resp_success(result=result, message=t("admin.notif.rules_reset", lang=lang))


@router.get(
    "/campaigns",
    summary="管理端-临时通知列表",
    description=(
        "分页查询临时通知活动。需管理员权限 notifications。\n\n"
        "**入参**（Query）\n"
        "- pageNum / pageSize: 分页\n"
        "- status: 可选 draft|scheduled|active|ended|cancelled\n\n"
        "**出参 result**：campaign 数组；并携带 pageInfo。\n"
        "- id / title / body / channel / status / platforms\n"
        "- start_at / end_at / bypass_quiet / remark / created_by / created_at / updated_at"
    ),
)
def list_campaigns(
    request: Request,
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=200),
    status: str = Query(""),
    admin: User = Depends(require_admin_perm(PERM_NOTIFICATIONS)),
    db: Session = Depends(get_db),
):
    """分页查询临时通知活动。"""

    lang = get_lang(request)
    result, total = NotificationService(db).list_campaigns(pageNum, pageSize, status=status)
    return resp_success(
        result=result,
        message=t("ok", lang=lang),
        page_info=build_page_info(pageNum, pageSize, total),
    )


@router.post(
    "/campaigns",
    summary="管理端-新建临时通知",
    description=(
        "创建一条临时通知活动。需管理员权限 notifications。\n\n"
        "**入参**\n"
        "- title: 标题\n"
        "- body: 正文\n"
        "- channel: system | promo\n"
        "- status: draft|scheduled|active|ended|cancelled\n"
        "- platforms: all 或 ios,android,web,pc\n"
        "- start_at / end_at: ISO datetime\n"
        "- bypass_quiet: 仅 system 渠道可穿透静默\n"
        "- remark: 备注\n\n"
        "**出参 result**：同 campaign 公开字段"
    ),
)
def create_campaign(
    body: NotificationCampaignCreate,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_NOTIFICATIONS)),
    db: Session = Depends(get_db),
):
    """创建一条临时通知活动。"""

    lang = get_lang(request)
    result = NotificationService(db).create_campaign(body, actor_id=admin.id)
    logger.info("admin create campaign actor=%s id=%s", admin.id, result.get("id"))
    return resp_success(result=result, message=t("admin.notif.campaign_created", lang=lang))


@router.put(
    "/campaigns/{campaign_id}",
    summary="管理端-更新临时通知",
    description=(
        "更新指定临时通知活动。需管理员权限 notifications。\n\n"
        "**入参**（均可选，只传要改的字段）\n"
        "- campaign_id: 路径参数\n"
        "- title / body / channel / status / platforms\n"
        "- start_at / end_at / bypass_quiet / remark\n\n"
        "**出参 result**：同 campaign 公开字段"
    ),
)
def update_campaign(
    campaign_id: int,
    body: NotificationCampaignUpdate,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_NOTIFICATIONS)),
    db: Session = Depends(get_db),
):
    """更新指定临时通知活动。"""

    lang = get_lang(request)
    result = NotificationService(db).update_campaign(campaign_id, body)
    logger.info("admin update campaign actor=%s id=%s", admin.id, campaign_id)
    return resp_success(result=result, message=t("admin.notif.campaign_updated", lang=lang))


@router.delete(
    "/campaigns/{campaign_id}",
    summary="管理端-删除临时通知",
    description=(
        "删除指定临时通知活动。需管理员权限 notifications。\n\n"
        "**入参**\n"
        "- campaign_id: 路径参数\n\n"
        "**出参 result**：空对象 {}"
    ),
)
def delete_campaign(
    campaign_id: int,
    request: Request,
    admin: User = Depends(require_admin_perm(PERM_NOTIFICATIONS)),
    db: Session = Depends(get_db),
):
    """删除指定临时通知活动。"""

    lang = get_lang(request)
    NotificationService(db).delete_campaign(campaign_id)
    logger.info("admin delete campaign actor=%s id=%s", admin.id, campaign_id)
    return resp_success(result={}, message=t("admin.notif.campaign_deleted", lang=lang))
