"""路由依赖：语言解析、Bearer JWT 鉴权（普通用户 / 管理员）。"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import ExpiredSignatureError, InvalidTokenError, PyJWTError
from sqlalchemy.orm import Session

from common.constants import (
    CODE_FORBIDDEN,
    CODE_TOKEN_EXPIRED,
    CODE_UNAUTHORIZED,
    CODE_USER_NOT_FOUND,
    ROLE_ADMIN,
)
from common.exceptions import AppError
from common.i18n import t
from common.logger import get_logger
from common.security import decode_access_token
from core.database import get_db
from models.user import User

logger = get_logger("deps")
bearer_scheme = HTTPBearer(auto_error=False)


def get_lang(request: Request) -> str:
    """从请求解析当前语言码（供 i18n 使用）。"""
    from common.i18n import resolve_lang

    return resolve_lang(request=request)


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    lang = get_lang(request)
    if credentials is None or not credentials.credentials:
        raise AppError(CODE_UNAUTHORIZED, "auth.unauthorized", message=t("auth.unauthorized", lang=lang))

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload.get("sub", 0))
    except ExpiredSignatureError:
        raise AppError(CODE_TOKEN_EXPIRED, "auth.token_expired", message=t("auth.token_expired", lang=lang))
    except (PyJWTError, InvalidTokenError, ValueError, TypeError):
        raise AppError(CODE_UNAUTHORIZED, "auth.unauthorized", message=t("auth.unauthorized", lang=lang))

    user = db.get(User, user_id)
    if user is None:
        raise AppError(CODE_USER_NOT_FOUND, "auth.user_not_found", message=t("auth.user_not_found", lang=lang))

    from service.account_purge import ensure_active_or_purge

    active, purge_at = ensure_active_or_purge(db, user)
    if active is None:
        raise AppError(CODE_USER_NOT_FOUND, "auth.user_not_found", message=t("auth.user_not_found", lang=lang))
    if purge_at is not None:
        from common.constants import ACCOUNT_DELETION_GRACE_DAYS, CODE_ACCOUNT_PENDING_DELETION
        from service.account_purge import purge_at_for

        purge_date = purge_at_for(active.deleted_at).strftime("%Y-%m-%d")
        raise AppError(
            CODE_ACCOUNT_PENDING_DELETION,
            "auth.account_pending_deletion",
            message=t(
                "auth.account_pending_deletion",
                lang=lang,
                purge_date=purge_date,
                grace_days=ACCOUNT_DELETION_GRACE_DAYS,
            ),
        )

    request.state.user_id = active.id
    request.state.username = active.username
    request.state.role = active.role
    return active


def get_current_admin(
    request: Request,
    user: User = Depends(get_current_user),
) -> User:
    lang = get_lang(request)
    if user.role != ROLE_ADMIN:
        logger.warning("forbidden admin access user_id=%s role=%s", user.id, user.role)
        raise AppError(CODE_FORBIDDEN, "auth.forbidden", message=t("auth.forbidden", lang=lang))
    return user


def require_admin_perm(permission: str):
    """FastAPI dependency factory: admin + specific module permission."""

    def _dep(
        request: Request,
        admin: User = Depends(get_current_admin),
    ) -> User:
        from common.permissions import require_permission

        lang = get_lang(request)
        try:
            require_permission(admin, permission)
        except AppError as exc:
            raise AppError(
                exc.code,
                exc.message_key,
                message=t(exc.message_key, lang=lang),
            ) from exc
        return admin

    return _dep
