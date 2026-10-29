"""可撤销的刷新令牌会话存储。"""

from __future__ import annotations

import uuid
from typing import Optional

from common.logger import get_logger
from common.redis_client import get_redis
from settings.config import get_settings

logger = get_logger("session_store")
PREFIX = "sess:rt:"


def new_jti() -> str:
    """生成刷新令牌的唯一会话标识。"""

    return uuid.uuid4().hex


def store_refresh_session(user_id: int, jti: str, ttl_seconds: Optional[int] = None) -> None:
    """按过期时间登记用户刷新会话。"""

    settings = get_settings()
    ttl = ttl_seconds or max(60, int(settings.refresh_token_expire_days) * 86400)
    try:
        get_redis().setex(f"{PREFIX}{jti}", ttl, str(user_id))
    except Exception:
        logger.exception("store refresh session failed jti=%s", jti)


def session_valid(user_id: int, jti: str) -> bool:
    """检查刷新会话是否仍属于指定用户。"""

    if not jti:
        return False
    try:
        val = get_redis().get(f"{PREFIX}{jti}")
        return val is not None and str(val) == str(user_id)
    except Exception:
        logger.exception("session valid check failed")
        return False


def revoke_refresh_session(jti: str) -> None:
    """撤销单个刷新会话。"""

    if not jti:
        return
    try:
        get_redis().delete(f"{PREFIX}{jti}")
    except Exception:
        logger.exception("revoke refresh session failed")


def revoke_all_user_sessions(user_id: int) -> None:
    """更新用户会话纪元以使旧令牌失效。"""
    settings = get_settings()
    ttl = max(60, int(settings.refresh_token_expire_days) * 86400)
    try:
        get_redis().setex(f"sess:epoch:{user_id}", ttl, str(int(__import__('time').time())))
    except Exception:
        logger.exception("revoke all sessions failed user_id=%s", user_id)


def user_epoch(user_id: int) -> int:
    """读取用户当前会话纪元。"""

    try:
        raw = get_redis().get(f"sess:epoch:{user_id}")
        return int(raw or 0)
    except Exception:
        return 0
