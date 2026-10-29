"""API 根路由：挂载各业务子路由，并提供 /health 与 /metrics。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from api.admin import router as admin_router
from api.admin_notifications import router as admin_notifications_router
from api.analytics import router as analytics_router
from api.auth import router as auth_router
from api.notifications import router as notifications_router
from api.report import router as report_router
from api.site import router as site_router
from api.notes import router as notes_router
from api.todos import router as todos_router
from common.deps import get_current_admin, get_lang
from common.i18n import resolve_lang, t
from common.metrics import metrics
from common.response import resp_success
from common.security import utc_now_iso
from core.database import ping_db
from models.user import User
from settings.config import get_settings

api_router = APIRouter(prefix="/api")


@api_router.get(
    "/health",
    summary="健康检查",
    description=(
        "服务健康检查。返回 UTC 时间与数据库连通性。无需鉴权。\n\n"
        "**出参 result**\n"
        "- status: up|degraded\n"
        "- db: ok|fail\n"
        "- utc: ISO-8601 UTC\n"
        "- version: 应用版本"
    ),
    tags=["系统"],
    openapi_extra={"security": []},
)
def health(request: Request):
    """健康检查：DB 可达则 up，否则 degraded（HTTP 503）。"""
    lang = resolve_lang(request=request)
    db_ok = ping_db()
    return resp_success(
        result={
            "status": "up" if db_ok else "degraded",
            "db": "ok" if db_ok else "fail",
            "utc": utc_now_iso(),
            "version": get_settings().app_version,
        },
        message=t("health.ok", lang=lang) if db_ok else t("health.degraded", lang=lang),
        http_status=200 if db_ok else 503,
    )


@api_router.get(
    "/metrics",
    summary="进程内指标快照",
    description=(
        "开发/运维用轻量指标（单进程）。生产多副本请换 Prometheus。需 admin。\n\n"
        "**出参 result**：进程内 counters / latency 摘要（由 metrics.snapshot() 决定）"
    ),
    tags=["系统"],
)
def metrics_snapshot(
    request: Request,
    _admin: User = Depends(get_current_admin),
):
    """返回仅管理员可见的进程内指标快照。"""

    lang = get_lang(request)
    return resp_success(result=metrics.snapshot(), message=t("ok", lang=lang))


api_router.include_router(auth_router)
api_router.include_router(todos_router)
api_router.include_router(notes_router)
api_router.include_router(report_router)
api_router.include_router(admin_router)
api_router.include_router(admin_notifications_router)
api_router.include_router(analytics_router)
api_router.include_router(site_router)
api_router.include_router(notifications_router)
