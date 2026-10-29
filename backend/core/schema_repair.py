"""Postgres 缺列补齐：create_all 不会给已有表加列，Alembic 失败时登录会 500。"""

from __future__ import annotations

from sqlalchemy import text

from common.logger import get_logger

logger = get_logger("schema_repair")

_USER_COLUMNS = (
    ("nickname", "VARCHAR(64) NOT NULL DEFAULT ''"),
    ("avatar", "TEXT NOT NULL DEFAULT ''"),
    ("signature", "VARCHAR(120) NOT NULL DEFAULT ''"),
    ("gender", "VARCHAR(16) NOT NULL DEFAULT ''"),
    ("deleted_at", "TIMESTAMPTZ"),
    ("register_method", "VARCHAR(32) NOT NULL DEFAULT 'password'"),
    ("register_region", "VARCHAR(64) NOT NULL DEFAULT ''"),
    ("register_platform", "VARCHAR(32) NOT NULL DEFAULT ''"),
    ("device_language", "VARCHAR(32) NOT NULL DEFAULT ''"),
    ("admin_permissions", "TEXT NOT NULL DEFAULT '*'"),
)


def ensure_postgres_columns(conn) -> None:
    """幂等补齐生产库中 ORM 已映射、但迁移可能未执行的列。"""

    statements = [
        *[f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {name} {ddl}" for name, ddl in _USER_COLUMNS],
        "ALTER TABLE sync_meta ADD COLUMN IF NOT EXISTS notes_list_updated_at DOUBLE PRECISION NOT NULL DEFAULT 0",
        "ALTER TABLE todos ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE",
        "CREATE INDEX IF NOT EXISTS ix_users_register_platform ON users (register_platform)",
        "CREATE INDEX IF NOT EXISTS ix_users_deleted_at ON users (deleted_at)",
        "CREATE INDEX IF NOT EXISTS ix_todos_user_deleted_updated ON todos (user_id, is_deleted, updated_at)",
        "CREATE INDEX IF NOT EXISTS ix_notes_user_deleted_updated ON notes (user_id, is_deleted, updated_at)",
    ]
    for sql in statements:
        try:
            conn.execute(text(sql))
        except Exception:
            logger.exception("schema repair skipped: %s", sql)
