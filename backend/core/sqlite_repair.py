"""开发环境 SQLite 历史结构漂移的兼容修复。"""

from __future__ import annotations

from sqlalchemy import text

from common.logger import get_logger

logger = get_logger("sqlite_repair")


def _table_columns(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def _table_exists(conn, table: str) -> bool:
    row = conn.execute(
        text("SELECT 1 FROM sqlite_master WHERE type='table' AND name=:name LIMIT 1"),
        {"name": table},
    ).fetchone()
    return row is not None


def repair_workspace_schema_drift(conn) -> None:
    """清理废弃工作区结构并恢复用户级同步表。"""
    conn.execute(text("PRAGMA foreign_keys=OFF"))

    for table in (
        "workspace_audit_logs",
        "workspace_invites",
        "workspace_members",
        "workspaces",
    ):
        if _table_exists(conn, table):
            conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
            logger.info("dropped leftover table %s", table)

    if _table_exists(conn, "sync_meta"):
        sync_cols = _table_columns(conn, "sync_meta")
        pk_rows = conn.execute(text("PRAGMA table_info(sync_meta)")).fetchall()
        pk_cols = {row[1] for row in pk_rows if row[5]}
        needs_rebuild = ("workspace_id" in sync_cols) or (pk_cols != {"user_id"})
        if needs_rebuild:
            conn.execute(text("DROP TABLE IF EXISTS sync_meta_new"))
            conn.execute(
                text(
                    """
                    CREATE TABLE sync_meta_new (
                        user_id INTEGER NOT NULL PRIMARY KEY,
                        list_updated_at REAL NOT NULL DEFAULT 0,
                        FOREIGN KEY(user_id) REFERENCES users(id)
                    )
                    """
                )
            )
            if "user_id" in sync_cols and "list_updated_at" in sync_cols:
                conn.execute(
                    text(
                        """
                        INSERT INTO sync_meta_new (user_id, list_updated_at)
                        SELECT user_id, MAX(list_updated_at)
                        FROM sync_meta
                        GROUP BY user_id
                        """
                    )
                )
            conn.execute(text("DROP TABLE sync_meta"))
            conn.execute(text("ALTER TABLE sync_meta_new RENAME TO sync_meta"))
            logger.info("rebuilt sync_meta to user-scoped schema")

    if _table_exists(conn, "sync_meta"):
        sync_cols = _table_columns(conn, "sync_meta")
        if "notes_list_updated_at" not in sync_cols:
            conn.execute(
                text(
                    "ALTER TABLE sync_meta ADD COLUMN notes_list_updated_at REAL NOT NULL DEFAULT 0"
                )
            )
            logger.info("migrated sync_meta.notes_list_updated_at column")

    if _table_exists(conn, "users"):
        conn.execute(
            text(
                """
                INSERT OR IGNORE INTO sync_meta (user_id, list_updated_at)
                SELECT id, 0 FROM users
                """
            )
        )
        user_cols = _table_columns(conn, "users")
        if "active_workspace_id" in user_cols:
            conn.execute(text("DROP TABLE IF EXISTS users_new"))
            conn.execute(
                text(
                    """
                    CREATE TABLE users_new (
                        id INTEGER NOT NULL PRIMARY KEY,
                        username VARCHAR(64) NOT NULL,
                        nickname VARCHAR(64) NOT NULL DEFAULT '',
                        avatar TEXT NOT NULL DEFAULT '',
                        signature VARCHAR(120) NOT NULL DEFAULT '',
                        gender VARCHAR(16) NOT NULL DEFAULT '',
                        hashed_password VARCHAR(255) NOT NULL,
                        role VARCHAR(16) NOT NULL,
                        created_at DATETIME NOT NULL,
                        deleted_at DATETIME
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO users_new (
                        id, username, nickname, avatar, signature, gender,
                        hashed_password, role, created_at, deleted_at
                    )
                    SELECT
                        id, username,
                        COALESCE(nickname, ''),
                        COALESCE(avatar, ''),
                        COALESCE(signature, ''),
                        COALESCE(gender, ''),
                        hashed_password, role, created_at,
                        deleted_at
                    FROM users
                    """
                )
            )
            conn.execute(text("DROP TABLE users"))
            conn.execute(text("ALTER TABLE users_new RENAME TO users"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_id ON users (id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_role ON users (role)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_deleted_at ON users (deleted_at)"))
            logger.info("rebuilt users without active_workspace_id")

    if _table_exists(conn, "todos"):
        todo_cols = _table_columns(conn, "todos")
        extra = {"workspace_id", "assignee_id", "visibility"} & todo_cols
        if extra:
            conn.execute(text("DROP TABLE IF EXISTS todos_new"))
            conn.execute(
                text(
                    """
                    CREATE TABLE todos_new (
                        id VARCHAR(64) NOT NULL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        title TEXT NOT NULL,
                        detail TEXT NOT NULL DEFAULT '',
                        due_at REAL NOT NULL DEFAULT 0,
                        completed BOOLEAN NOT NULL,
                        created_at FLOAT NOT NULL,
                        updated_at FLOAT NOT NULL,
                        FOREIGN KEY(user_id) REFERENCES users(id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO todos_new (
                        id, user_id, title, detail, due_at, completed, created_at, updated_at
                    )
                    SELECT
                        id, user_id, title,
                        COALESCE(detail, ''),
                        COALESCE(due_at, 0),
                        completed, created_at, updated_at
                    FROM todos
                    """
                )
            )
            conn.execute(text("DROP TABLE todos"))
            conn.execute(text("ALTER TABLE todos_new RENAME TO todos"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_todos_user_id ON todos (user_id)"))
            logger.info("rebuilt todos without workspace columns %s", sorted(extra))


def ensure_sqlite_columns(conn) -> None:
    """为旧版 SQLite 数据库补齐缺失字段。"""
    if not _table_exists(conn, "todos"):
        return
    cols = _table_columns(conn, "todos")
    if "detail" not in cols:
        conn.execute(text("ALTER TABLE todos ADD COLUMN detail TEXT NOT NULL DEFAULT ''"))
        logger.info("migrated todos.detail column")
        cols = _table_columns(conn, "todos")
    if "due_at" not in cols:
        conn.execute(text("ALTER TABLE todos ADD COLUMN due_at REAL NOT NULL DEFAULT 0"))
        logger.info("migrated todos.due_at column")

    if not _table_exists(conn, "users"):
        return
    user_cols = _table_columns(conn, "users")
    if "nickname" not in user_cols:
        conn.execute(text("ALTER TABLE users ADD COLUMN nickname VARCHAR(64) NOT NULL DEFAULT ''"))
        logger.info("migrated users.nickname column")
        user_cols = _table_columns(conn, "users")
    if "avatar" not in user_cols:
        conn.execute(text("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ''"))
        logger.info("migrated users.avatar column")
    if "signature" not in user_cols:
        conn.execute(text("ALTER TABLE users ADD COLUMN signature VARCHAR(120) NOT NULL DEFAULT ''"))
        logger.info("migrated users.signature column")
    if "gender" not in user_cols:
        conn.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR(16) NOT NULL DEFAULT ''"))
        logger.info("migrated users.gender column")
        user_cols = _table_columns(conn, "users")
    if "deleted_at" not in user_cols:
        conn.execute(text("ALTER TABLE users ADD COLUMN deleted_at DATETIME"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_deleted_at ON users (deleted_at)"))
        logger.info("migrated users.deleted_at column")
        user_cols = _table_columns(conn, "users")
    if "register_method" not in user_cols:
        conn.execute(
            text("ALTER TABLE users ADD COLUMN register_method VARCHAR(32) NOT NULL DEFAULT 'password'")
        )
        logger.info("migrated users.register_method column")
        user_cols = _table_columns(conn, "users")
    if "register_region" not in user_cols:
        conn.execute(
            text("ALTER TABLE users ADD COLUMN register_region VARCHAR(64) NOT NULL DEFAULT ''")
        )
        logger.info("migrated users.register_region column")
        user_cols = _table_columns(conn, "users")
    if "register_platform" not in user_cols:
        conn.execute(
            text("ALTER TABLE users ADD COLUMN register_platform VARCHAR(32) NOT NULL DEFAULT ''")
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_register_platform ON users (register_platform)"))
        logger.info("migrated users.register_platform column")
        user_cols = _table_columns(conn, "users")
    if "device_language" not in user_cols:
        conn.execute(
            text("ALTER TABLE users ADD COLUMN device_language VARCHAR(32) NOT NULL DEFAULT ''")
        )
        logger.info("migrated users.device_language column")
        user_cols = _table_columns(conn, "users")
    if "admin_permissions" not in user_cols:
        conn.execute(
            text("ALTER TABLE users ADD COLUMN admin_permissions TEXT NOT NULL DEFAULT '*'")
        )
        logger.info("migrated users.admin_permissions column")
        # Ensure existing admins keep full access
        conn.execute(
            text("UPDATE users SET admin_permissions='*' WHERE role='admin'")
        )

    # Heal aborted site_configs schema (column was briefly named `data`)
    if _table_exists(conn, "site_configs"):
        sc_cols = _table_columns(conn, "site_configs")
        if "data" in sc_cols and "config_json" not in sc_cols:
            conn.execute(text("DROP TABLE IF EXISTS site_configs_new"))
            conn.execute(
                text(
                    """
                    CREATE TABLE site_configs_new (
                        id INTEGER NOT NULL PRIMARY KEY,
                        config_json TEXT NOT NULL,
                        updated_at DATETIME NOT NULL
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO site_configs_new (id, config_json, updated_at)
                    SELECT id, COALESCE(data, '{}'), COALESCE(updated_at, CURRENT_TIMESTAMP)
                    FROM site_configs
                    """
                )
            )
            conn.execute(text("DROP TABLE site_configs"))
            conn.execute(text("ALTER TABLE site_configs_new RENAME TO site_configs"))
            logger.info("rebuilt site_configs with config_json column")

    # site_visits: add platform/country dimensions
    if _table_exists(conn, "site_visits"):
        sv_cols = _table_columns(conn, "site_visits")
        if "platform" not in sv_cols or "country" not in sv_cols:
            conn.execute(text("DROP TABLE IF EXISTS site_visits_new"))
            conn.execute(
                text(
                    """
                    CREATE TABLE site_visits_new (
                        visit_date DATE NOT NULL,
                        platform VARCHAR(32) NOT NULL DEFAULT '',
                        country VARCHAR(64) NOT NULL DEFAULT '',
                        count INTEGER NOT NULL DEFAULT 0,
                        updated_at DATETIME NOT NULL,
                        PRIMARY KEY (visit_date, platform, country)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO site_visits_new (visit_date, platform, country, count, updated_at)
                    SELECT visit_date, '', '', count, updated_at FROM site_visits
                    """
                )
            )
            conn.execute(text("DROP TABLE site_visits"))
            conn.execute(text("ALTER TABLE site_visits_new RENAME TO site_visits"))
            logger.info("rebuilt site_visits with platform/country dimensions")
