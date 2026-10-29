"""管理端权限键、序列化与校验工具。"""

from __future__ import annotations

import json
from typing import Any, Iterable, List, Sequence

from common.constants import ROLE_ADMIN
from common.exceptions import AppError
from common.constants import CODE_FORBIDDEN, CODE_VALIDATION_ERROR

# Module-level permissions aligned with web-admin routes
PERM_STATS = "stats"
PERM_USERS = "users"
PERM_TODOS = "todos"
PERM_NOTES = "notes"
PERM_LLM = "llm"
PERM_ADMINS = "admins"
PERM_SITE = "site"
PERM_NOTIFICATIONS = "notifications"

ALL_PERMISSIONS: tuple[str, ...] = (
    PERM_STATS,
    PERM_USERS,
    PERM_TODOS,
    PERM_NOTES,
    PERM_LLM,
    PERM_ADMINS,
    PERM_SITE,
    PERM_NOTIFICATIONS,
)

PERM_LABELS = {
    PERM_STATS: "admin.perm.stats",
    PERM_USERS: "admin.perm.users",
    PERM_TODOS: "admin.perm.todos",
    PERM_NOTES: "admin.perm.notes",
    PERM_LLM: "admin.perm.llm",
    PERM_ADMINS: "admin.perm.admins",
    PERM_SITE: "admin.perm.site",
    PERM_NOTIFICATIONS: "admin.perm.notifications",
}

# Frontend route names + i18n keys (keep in sync with web-admin)
PERM_ROUTES = {
    PERM_STATS: "stats",
    PERM_USERS: "users",
    PERM_TODOS: "todos",
    PERM_NOTES: "notes",
    PERM_LLM: "llm-models",
    PERM_ADMINS: "admins",
    PERM_SITE: "site-config",
    PERM_NOTIFICATIONS: "notifications",
}

PERM_LABEL_KEYS = {
    PERM_STATS: "nav.stats",
    PERM_USERS: "nav.users",
    PERM_TODOS: "nav.todos",
    PERM_NOTES: "nav.notes",
    PERM_LLM: "nav.llm",
    PERM_ADMINS: "nav.admins",
    PERM_SITE: "nav.site",
    PERM_NOTIFICATIONS: "nav.notifications",
}

PERM_ALL = "*"


def normalize_permissions(raw: Any) -> List[str]:
    """将存储值规范为去重权限列表或全权限标记。"""
    if raw is None:
        return [PERM_ALL]
    if isinstance(raw, list):
        items = raw
    else:
        text = str(raw).strip()
        if not text:
            return [PERM_ALL]
        if text == PERM_ALL:
            return [PERM_ALL]
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                items = parsed
            elif parsed == PERM_ALL:
                return [PERM_ALL]
            else:
                items = [str(parsed)]
        except json.JSONDecodeError:
            items = [p.strip() for p in text.split(",") if p.strip()]

    if PERM_ALL in items or "*" in items:
        return [PERM_ALL]

    out: List[str] = []
    seen = set()
    for item in items:
        key = str(item).strip().lower()
        if key in ALL_PERMISSIONS and key not in seen:
            seen.add(key)
            out.append(key)
    return out


def serialize_permissions(perms: Sequence[str]) -> str:
    """将权限列表序列化为数据库存储字符串。"""

    normalized = normalize_permissions(list(perms))
    if normalized == [PERM_ALL]:
        return PERM_ALL
    return json.dumps(normalized, ensure_ascii=False)


def validate_permissions(perms: Iterable[str]) -> List[str]:
    """校验并返回规范化的管理端权限。"""

    normalized = normalize_permissions(list(perms))
    if not normalized:
        raise AppError(CODE_VALIDATION_ERROR, "admin.permissions_empty")
    if normalized != [PERM_ALL]:
        for p in normalized:
            if p not in ALL_PERMISSIONS:
                raise AppError(CODE_VALIDATION_ERROR, "admin.permissions_invalid")
    return normalized


def get_user_permissions(user: Any) -> List[str]:
    """返回管理员的规范化权限列表。"""

    if getattr(user, "role", None) != ROLE_ADMIN:
        return []
    raw = getattr(user, "admin_permissions", None)
    return normalize_permissions(raw)


def has_permission(user: Any, permission: str) -> bool:
    """检查管理员是否拥有指定权限。"""

    if getattr(user, "role", None) != ROLE_ADMIN:
        return False
    perms = get_user_permissions(user)
    if PERM_ALL in perms:
        return True
    return permission in perms


def require_permission(user: Any, permission: str) -> None:
    """要求管理员拥有指定权限，否则抛出业务异常。"""

    if not has_permission(user, permission):
        raise AppError(CODE_FORBIDDEN, "admin.permission_denied")


def permission_catalog() -> List[dict]:
    """返回管理端可配置权限目录（含前端路由与 i18n key，避免双端漂移）。"""

    return [
        {
            "key": k,
            "label": PERM_LABELS[k],
            "route": PERM_ROUTES[k],
            "label_key": PERM_LABEL_KEYS[k],
        }
        for k in ALL_PERMISSIONS
    ]
