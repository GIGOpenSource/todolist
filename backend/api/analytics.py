"""官网访问埋点路由（公开，IP 限流）。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from common.admin_filters import normalize_platform
from common.constants import CLIENT_PLATFORM_HEADER
from common.i18n import resolve_lang, t
from common.logger import get_logger
from common.rate_limit import client_ip, rate_limit
from common.response import resp_success
from core.database import get_db
from service.admin_service import AdminService

logger = get_logger("api.analytics")
router = APIRouter(prefix="/analytics", tags=["埋点"])


class VisitBody(BaseModel):
    """官网访问埋点请求。"""

    platform: str = Field("", description="ios|android|web|pc")
    country: str = Field("", description="国家/地区代码")


@router.post(
    "/visits",
    summary="创建官网访问记录",
    description=(
        "公开接口：创建一条官网访问累计（按 UTC 日历日 + 平台 + 国家）。IP 限流。\n\n"
        "**入参**\n"
        "- platform: ios|android|web|pc（亦可由 X-Client-Platform 推导）\n"
        "- country: 国家/地区代码（可选）\n\n"
        "**出参 result**：写入后的访问累计摘要"
    ),
    openapi_extra={"security": []},
)
def create_visit(
    request: Request,
    db: Session = Depends(get_db),
    body: VisitBody = VisitBody(),
):
    """按 UTC 日历日、平台与国家累计一次官网访问。"""

    lang = resolve_lang(request=request)
    rate_limit(f"visit:{client_ip(request)}", limit=30, window_seconds=60.0)
    platform = normalize_platform(
        body.platform or request.headers.get(CLIENT_PLATFORM_HEADER) or "web"
    ) or "web"
    country = (
        body.country
        or request.headers.get("CF-IPCountry")
        or request.headers.get("X-Country")
        or ""
    ).strip()
    result = AdminService(db, lang=lang).record_site_visit(platform=platform, country=country)
    logger.info(
        "site visit recorded date=%s platform=%s country=%s count=%s",
        result.get("visit_date"),
        result.get("platform"),
        result.get("country"),
        result.get("count"),
    )
    return resp_success(result=result, message=t("ok", lang=lang))
