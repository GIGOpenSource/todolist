"""数据库引擎、会话与表结构初始化。"""

from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from common.logger import get_logger
from settings.config import get_settings

logger = get_logger("database")
settings = get_settings()

_is_sqlite = (settings.database_url or "").startswith("sqlite")
connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine_kwargs: dict = {"connect_args": connect_args}
if _is_sqlite:
    # SQLite: StaticPool-ish via check_same_thread; keep small pool
    engine_kwargs.update(
        {
            "pool_pre_ping": True,
        }
    )
else:
    engine_kwargs.update(
        {
            "pool_size": settings.db_pool_size,
            "max_overflow": settings.db_max_overflow,
            "pool_pre_ping": True,
            "pool_recycle": settings.db_pool_recycle,
        }
    )

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """SQLAlchemy 声明式模型基类。"""

    pass


def get_db():
    """按请求提供数据库会话并在结束后关闭。"""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ping_db() -> bool:
    """执行轻量查询检查数据库连接是否可用。"""

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.exception("database ping failed")
        return False


def ensure_perf_indexes(conn) -> None:
    """幂等创建待办同步热路径所需索引。"""
    statements = [
        "CREATE INDEX IF NOT EXISTS ix_todos_user_updated ON todos (user_id, updated_at)",
        "CREATE INDEX IF NOT EXISTS ix_todos_user_created ON todos (user_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_notes_user_updated ON notes (user_id, updated_at)",
        "CREATE INDEX IF NOT EXISTS ix_notes_user_created ON notes (user_id, created_at)",
    ]
    for sql in statements:
        try:
            conn.execute(text(sql))
        except Exception:
            logger.exception("ensure index failed: %s", sql)


def init_db() -> None:
    """注册模型、创建表并修复开发库兼容结构。"""

    # Import models so metadata is registered
    from models import (  # noqa: F401
        llm_model_config,
        notification_campaign,
        notification_config,
        report_job,
        site_config,
        site_visit,
        note,
        sync_meta,
        todo,
        user,
        user_login_day,
    )

    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        if _is_sqlite:
            from core.sqlite_repair import ensure_sqlite_columns, repair_workspace_schema_drift

            repair_workspace_schema_drift(conn)
            ensure_sqlite_columns(conn)
        else:
            from core.schema_repair import ensure_postgres_columns

            ensure_postgres_columns(conn)
        ensure_perf_indexes(conn)

    logger.info("database tables ensured url=%s", settings.database_url.split("://")[0])
