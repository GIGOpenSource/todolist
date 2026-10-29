"""认证路由：注册/登录/刷新/资料/改密/账号软删与头像预签名。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from common.deps import get_current_user, get_lang
from common.i18n import t
from common.logger import get_logger
from common.rate_limit import auth_rate_key, rate_limit
from common.response import resp_success
from core.database import get_db
from models.user import User
from schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RestoreAccountRequest,
    TouchStreakRequest,
    UpdateProfileRequest,
)
from pydantic import BaseModel, Field
from service.auth_service import AuthService
from settings.config import get_settings

logger = get_logger("api.auth")
router = APIRouter(prefix="/auth", tags=["认证"])


class LogoutRequest(BaseModel):
    """登出与刷新会话吊销请求。"""

    refresh_token: str = Field("", description="可选；传入则吊销该 refresh")


class AvatarPresignRequest(BaseModel):
    """头像对象存储预签名请求。"""

    content_type: str = Field("image/jpeg", description="image/jpeg|png|webp|gif")



def _auth_limit(request: Request, username: str) -> None:
    settings = get_settings()
    rate_limit(auth_rate_key(request, username), settings.rate_limit_auth_per_minute)


@router.post(
    "/register",
    summary="用户注册",
    description=(
        "注册普通用户账号并返回 Bearer Token。\n\n"
        "**入参**\n"
        "- username: 登录用户名，3-64 字符\n"
        "- password: 密码，至少 6 位\n\n"
        "**出参 result**\n"
        "- access_token / refresh_token / token_type / username / nickname / avatar / signature / gender / role / expires_in\n\n"
        "无需鉴权。"
    ),
    openapi_extra={"security": []},
)
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """注册普通用户并签发访问与刷新令牌。"""

    lang = get_lang(request)
    _auth_limit(request, body.username)
    logger.info("register request username=%s", body.username)
    meta = AuthService.register_meta_from_request(request)
    result = AuthService(db).register(
        body.username,
        body.password,
        register_region=meta["register_region"],
        register_method="password",
        register_platform=meta["register_platform"],
        device_language=meta["device_language"],
    )
    return resp_success(result=result.model_dump(), message=t("auth.register.success", lang=lang))


@router.post(
    "/login",
    summary="用户登录",
    description=(
        "账号密码登录，返回 Bearer Token。\n\n"
        "**入参**\n"
        "- username: 登录用户名\n"
        "- password: 密码\n\n"
        "**出参 result**\n"
        "- access_token / refresh_token / token_type / username / nickname / avatar / signature / gender / role / expires_in\n\n"
        "若账号处于软删除宽限期内，返回 code=40302、result=null；"
        "message 含可恢复截止日（purge_date）。客户端凭 40302 提示恢复。\n\n"
        "无需鉴权。"
    ),
    openapi_extra={"security": []},
)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """校验账号密码并签发访问与刷新令牌。"""

    lang = get_lang(request)
    _auth_limit(request, body.username)
    logger.info("login request username=%s", body.username)
    from common.constants import ACCEPT_LANGUAGE_HEADER, DEVICE_LANGUAGE_HEADER
    from common.i18n import parse_device_language

    device_lang = parse_device_language(
        device_header=request.headers.get(DEVICE_LANGUAGE_HEADER) or "",
        accept_language=request.headers.get(ACCEPT_LANGUAGE_HEADER) or "",
    )
    result = AuthService(db).login(
        body.username, body.password, device_language=device_lang, lang=lang
    )
    return resp_success(result=result.model_dump(), message=t("auth.login.success", lang=lang))


@router.post(
    "/tokens",
    summary="用 refresh 创建新令牌对",
    description=(
        "创建新的 access/refresh 令牌资源（由 refresh_token 换取）。无需 Bearer。\n\n"
        "**入参** refresh_token\n"
        "**出参** 同登录 TokenResult"
    ),
    openapi_extra={"security": []},
)
def create_tokens(body: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    """轮换刷新会话并签发新令牌。"""

    lang = get_lang(request)
    rate_limit(auth_rate_key(request, "refresh"), get_settings().rate_limit_auth_per_minute * 3)
    result = AuthService(db).refresh(body.refresh_token)
    return resp_success(result=result.model_dump(), message=t("auth.refresh.success", lang=lang))


@router.delete(
    "/sessions",
    summary="删除刷新会话（登出）",
    description=(
        "删除（吊销）指定 refresh 会话。可选 Bearer。\n\n"
        "**入参**\n"
        "- refresh_token: 可选；传入则吊销该 refresh\n\n"
        "**出参 result**：空对象 {}"
    ),
    openapi_extra={"security": []},
)
def delete_session(body: LogoutRequest, request: Request, db: Session = Depends(get_db)):
    """吊销传入的刷新令牌会话。"""

    lang = get_lang(request)
    AuthService(db).logout(body.refresh_token or "")
    return resp_success(result={}, message=t("auth.logout.success", lang=lang))


@router.post(
    "/avatar-uploads",
    summary="创建头像直传凭证",
    description=(
        "创建一次头像对象存储直传资源（预签名 PUT）。完成后将 public_url 写入 PUT /profile.avatar。"
        "需配置 OSS 且 Bearer 登录。\n\n"
        "**入参**\n"
        "- content_type: image/jpeg|png|webp|gif\n\n"
        "**出参 result**\n"
        "- upload_url / public_url / object_key / content_type / expires_in / headers"
    ),
)
def create_avatar_upload(
    body: AvatarPresignRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建头像直传对象存储的预签名信息。"""

    lang = get_lang(request)
    result = AuthService(db).avatar_presign(user, body.content_type)
    return resp_success(result=result, message=t("ok", lang=lang))


@router.get(
    "/me",
    summary="当前用户资料",
    description=(
        "返回当前用户资料。需 Bearer Token。\n\n"
        "**出参 result**\n"
        "- username / nickname / avatar / signature / gender / role / streak_days\n\n"
        "访问时会记入今日打开日，并返回连续打开天数（中断归零）。"
    ),
)
def me(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回当前用户资料与连续打开天数。"""

    lang = get_lang(request)
    result = AuthService(db).get_profile(user, touch_login_day=True)
    return resp_success(result=result.model_dump(mode="json"), message=t("ok", lang=lang))


@router.put(
    "/streak",
    summary="更新打开日连续记录",
    description=(
        "更新（upsert）今日打开日与可选历史打开日，返回连续天数。\n\n"
        "**连续规则**：从今天（若今日未打开则从昨天）往前数连续有打开记录的天数；"
        "中间断一天则 streak 归零后重新计数。\n\n"
        "**入参**\n"
        "- day: 可选 YYYY-MM-DD（客户端本地日）\n"
        "- days: 可选打开日列表，用于补齐本地历史\n\n"
        "**出参 result**\n"
        "- day / streak_days"
    ),
)
def put_streak(
    body: TouchStreakRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """记录打开日期并返回连续打开天数。"""

    lang = get_lang(request)
    settings = get_settings()
    rate_limit(
        auth_rate_key(request, f"streak:{user.id}"),
        settings.rate_limit_auth_per_minute * 3,
    )
    result = AuthService(db).touch_streak(user, day=body.day, days=body.days)
    return resp_success(result=result.model_dump(), message=t("ok", lang=lang))


@router.put(
    "/profile",
    summary="更新个人资料",
    description=(
        "更新个人资料（登录用户名不可改）。需 Bearer Token。\n\n"
        "**入参**（均可选，只传要改的字段）\n"
        "- nickname / signature / gender（male|female|other|空）\n"
        "- avatar：data URL 或 http(s) URL，传空串可清空\n\n"
        "**出参 result**\n"
        "- username / nickname / avatar / signature / gender / role / streak_days"
    ),
)
def update_profile(
    body: UpdateProfileRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新当前用户可编辑的个人资料。"""

    lang = get_lang(request)
    result = AuthService(db).update_profile(user, body)
    return resp_success(result=result.model_dump(mode="json"), message=t("auth.profile.updated", lang=lang))


@router.put(
    "/password",
    summary="修改密码",
    description=(
        "校验旧密码后更新为新密码。需 Bearer Token。\n\n"
        "**入参**\n"
        "- old_password: 当前密码\n"
        "- new_password: 新密码，至少 6 位\n\n"
        "**出参** 同登录 TokenResult（吊销其他会话后为本机签发新令牌）"
    ),
)
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """校验旧密码、更新密码并轮换会话。"""

    lang = get_lang(request)
    result = AuthService(db).change_password(user, body.old_password, body.new_password)
    return resp_success(result=result.model_dump(), message=t("auth.password.changed", lang=lang))


@router.delete(
    "/account",
    summary="删除账号（软删除）",
    description=(
        "软删除当前账号资源：30 天内可 PUT /account 恢复；逾期硬删除。\n"
        "管理员账号不可删除。需 Bearer Token。\n\n"
        "**出参 result**\n"
        "- deleted_at / purge_at / grace_days"
    ),
)
def delete_account(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """将当前普通用户账号标记为待删除。"""

    lang = get_lang(request)
    result = AuthService(db).schedule_delete(user)
    return resp_success(
        result=result.model_dump(mode="json"),
        message=t("auth.account_delete.scheduled", lang=lang),
    )


@router.put(
    "/account",
    summary="恢复已软删账号",
    description=(
        "在软删除宽限期内，用账号密码恢复账号资源并登录。无需 Bearer Token。\n\n"
        "**入参** username / password\n"
        "**出参** 同登录 TokenResult"
    ),
    openapi_extra={"security": []},
)
def restore_account(body: RestoreAccountRequest, request: Request, db: Session = Depends(get_db)):
    """在宽限期内恢复软删除账号并登录。"""

    lang = get_lang(request)
    _auth_limit(request, body.username)
    result = AuthService(db).restore_account(body.username, body.password)
    return resp_success(result=result.model_dump(), message=t("auth.account_restore.success", lang=lang))
