"""官网公开配置路由。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from common.i18n import resolve_lang, t
from common.logger import get_logger
from common.response import resp_success
from core.database import get_db
from service.site_service import SiteService

logger = get_logger("api.site")
router = APIRouter(prefix="/site", tags=["官网"])


@router.get(
    "/config",
    summary="官网公开配置",
    description=(
        "返回官网 CMS 配置（品牌、下载链接、文案覆盖等）。无需鉴权。\n\n"
        "**出参 result**：站点配置 JSON（brand / downloads / locale 覆盖等字段以 CMS 为准）"
    ),
    openapi_extra={"security": []},
)
def get_site_config(request: Request, db: Session = Depends(get_db)):
    """返回无需鉴权的官网公开配置。"""

    lang = resolve_lang(request=request)
    result = SiteService(db).get_config()
    return resp_success(result=result, message=t("ok", lang=lang))
