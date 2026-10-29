"""密码哈希与 JWT 签发/校验（access / refresh）；时间一律 UTC。"""

from __future__ import annotations

from datetime import timedelta
from typing import Any, Optional

import jwt
from passlib.context import CryptContext

from common.constants import ROLE_USER
from common.logger import get_logger
from common.session_store import new_jti, store_refresh_session, user_epoch
from settings.config import get_settings
from utils.time_util import utc_now, utc_now_iso, utc_now_ts

logger = get_logger("security")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def _bcrypt_secret(password: str) -> str:
    """bcrypt 只接受 72 字节；超长口令按 UTF-8 截断，兼容旧版静默截断。"""
    raw = (password or "").encode("utf-8")
    if len(raw) <= 72:
        return password or ""
    raw = raw[:72]
    while raw and (raw[-1] & 0xC0) == 0x80:
        raw = raw[:-1]
    return raw.decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    """使用 bcrypt 哈希明文密码。"""
    return pwd_context.hash(_bcrypt_secret(password))


def verify_password(plain: str, hashed: str) -> bool:
    """校验明文密码是否匹配哈希值。哈希损坏或超长口令不得变成 500。"""
    if not hashed:
        return False
    try:
        return pwd_context.verify(_bcrypt_secret(plain), hashed)
    except Exception:
        logger.warning("password verify rejected due to hash/format error")
        return False


def _encode(payload: dict[str, Any]) -> str:
    settings = get_settings()
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    if isinstance(token, bytes):
        return token.decode("ascii")
    return token


def create_access_token(user_id: int, username: str, role: str = ROLE_USER) -> str:
    """签发携带用户会话纪元的访问令牌。"""

    settings = get_settings()
    expire = utc_now() + timedelta(minutes=max(1, int(settings.access_token_expire_minutes)))
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "typ": TOKEN_TYPE_ACCESS,
        "exp": int(expire.timestamp()),
        "epoch": user_epoch(user_id),
    }
    token = _encode(payload)
    logger.debug("issued access token user_id=%s role=%s exp=%s", user_id, role, expire.isoformat())
    return token


def create_refresh_token(user_id: int, username: str, role: str = ROLE_USER) -> str:
    """签发刷新令牌并登记可撤销会话。"""

    settings = get_settings()
    expire = utc_now() + timedelta(days=max(1, int(settings.refresh_token_expire_days)))
    jti = new_jti()
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "typ": TOKEN_TYPE_REFRESH,
        "jti": jti,
        "exp": int(expire.timestamp()),
        "epoch": user_epoch(user_id),
    }
    token = _encode(payload)
    store_refresh_session(user_id, jti)
    return token


def decode_access_token(token: str) -> dict:
    """验证并解析访问令牌。"""

    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except jwt.PyJWTError as exc:
        logger.warning("token decode failed: %s", exc)
        raise
    typ = payload.get("typ") or TOKEN_TYPE_ACCESS
    if typ != TOKEN_TYPE_ACCESS:
        raise jwt.InvalidTokenError("not an access token")
    return payload


def decode_refresh_token(token: str) -> dict:
    """验证并解析刷新令牌。"""

    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except jwt.PyJWTError as exc:
        logger.warning("refresh decode failed: %s", exc)
        raise
    if payload.get("typ") != TOKEN_TYPE_REFRESH:
        raise jwt.InvalidTokenError("not a refresh token")
    return payload


__all__ = [
    "TOKEN_TYPE_ACCESS",
    "TOKEN_TYPE_REFRESH",
    "create_access_token",
    "create_refresh_token",
    "decode_access_token",
    "decode_refresh_token",
    "hash_password",
    "utc_now",
    "utc_now_iso",
    "utc_now_ts",
    "verify_password",
]
