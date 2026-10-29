"""FastAPI 应用工厂：中间件、路由、启动时种子管理员与周期清理。"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from api.router import api_router
from common.constants import ROLE_ADMIN
from common.logger import get_logger, setup_logging
from common.security import hash_password
from core.database import SessionLocal, init_db
from core.middleware import RequestContextMiddleware, register_exception_handlers
from models.user import User
from service.account_purge import purge_expired_deleted_accounts
from settings.config import get_settings

logger = get_logger("app")


def _ensure_admin() -> None:
    """若不存在配置中的管理员账号则创建种子管理员（权限 *）。"""
    settings = get_settings()
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == settings.admin_username).first()
        if admin is None:
            admin = User(
                username=settings.admin_username,
                hashed_password=hash_password(settings.admin_password),
                role=ROLE_ADMIN,
                admin_permissions="*",
            )
            db.add(admin)
            db.commit()
            logger.info("bootstrap admin created username=%s", settings.admin_username)
        else:
            changed = False
            if admin.role != ROLE_ADMIN:
                admin.role = ROLE_ADMIN
                changed = True
            raw = (getattr(admin, "admin_permissions", None) or "").strip()
            if not raw:
                admin.admin_permissions = "*"
                changed = True
            if changed:
                db.add(admin)
                db.commit()
                logger.info("bootstrap admin repaired username=%s", settings.admin_username)
    except Exception:
        logger.exception("bootstrap admin failed")
        db.rollback()
    finally:
        db.close()


def _ensure_admin_notes_permission() -> None:
    """笔记模块上线后，给非 * 的管理员补上 notes 权限（侧栏才能看到「笔记列表」）。"""
    from common.permissions import PERM_ALL, PERM_NOTES, normalize_permissions, serialize_permissions

    db = SessionLocal()
    try:
        admins = db.query(User).filter(User.role == ROLE_ADMIN).all()
        fixed = 0
        for admin in admins:
            perms = normalize_permissions(getattr(admin, "admin_permissions", None))
            if PERM_ALL in perms or "*" in perms:
                continue
            if PERM_NOTES in perms:
                continue
            perms.append(PERM_NOTES)
            admin.admin_permissions = serialize_permissions(perms)
            db.add(admin)
            fixed += 1
        if fixed:
            db.commit()
            logger.info("bootstrap granted notes permission to %s admin(s)", fixed)
    except Exception:
        logger.exception("bootstrap admin notes permission failed")
        db.rollback()
    finally:
        db.close()


def _ensure_notification_seed() -> None:
    """开发环境通知活动为空时写入演示数据。"""
    settings = get_settings()
    if settings.env in ("pro", "prod", "production"):
        return
    db = SessionLocal()
    try:
        from service.notification_seed import seed_demo_notification_campaigns

        n = seed_demo_notification_campaigns(db)
        if n:
            logger.info("bootstrap notification seed inserted=%s", n)
    except Exception:
        logger.exception("bootstrap notification seed failed")
        db.rollback()
    finally:
        db.close()


def _purge_soft_deleted() -> None:
    """清理超过保留期的软删除账号。"""

    db = SessionLocal()
    try:
        purge_expired_deleted_accounts(db)
    except Exception:
        logger.exception("purge soft-deleted accounts failed")
        db.rollback()
    finally:
        db.close()


async def _purge_loop(interval: int, stop: asyncio.Event) -> None:
    """按固定间隔执行软删除账号清理。"""

    while not stop.is_set():
        try:
            await asyncio.to_thread(_purge_soft_deleted)
        except Exception:
            logger.exception("scheduled purge failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=max(30, interval))
            break
        except asyncio.TimeoutError:
            continue


async def _report_worker_loop(stop: asyncio.Event) -> None:
    """从 Redis 或内存队列消费汇报任务。"""
    from common.redis_client import get_redis
    from core.database import SessionLocal
    from service.report_job_service import ReportJobService

    settings = get_settings()
    r = get_redis()
    while not stop.is_set():
        try:
            item = await asyncio.to_thread(r.brpop, settings.report_queue_key, 1)
            if not item:
                continue
            _, job_id = item
            db = SessionLocal()
            try:
                await ReportJobService(db).process_one(str(job_id))
            finally:
                db.close()
        except Exception:
            logger.exception("report worker iteration failed")
            await asyncio.sleep(0.5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """管理应用启动初始化及后台任务的生命周期。"""

    settings = get_settings()
    settings.validate_for_runtime()
    init_db()
    _ensure_admin()
    _ensure_admin_notes_permission()
    _ensure_notification_seed()
    _purge_soft_deleted()
    logger.info("app started env=%s utc_only=true version=%s", settings.env, settings.app_version)

    stop = asyncio.Event()
    tasks = []
    if settings.account_purge_interval_seconds > 0:
        tasks.append(asyncio.create_task(_purge_loop(settings.account_purge_interval_seconds, stop)))
    tasks.append(asyncio.create_task(_report_worker_loop(stop)))

    try:
        yield
    finally:
        stop.set()
        for task in tasks:
            await task


def create_app() -> FastAPI:
    """创建并配置 Upgrade FastAPI 应用。"""

    setup_logging()
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Upgrade API（UTC / 统一响应 / Bearer 鉴权 / i18n）\n\n"
            "统一返回：`{ code, message, result }`；分页额外携带 `pageInfo`。\n"
            "鉴权：请求头 `Authorization: Bearer {token}`；可用 refresh_token 续期。"
        ),
        swagger_ui_parameters={"persistAuthorization": True},
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app)
    app.include_router(api_router)

    def custom_openapi():
        """生成带 Bearer 鉴权声明的 OpenAPI 文档。"""

        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
        schema.setdefault("components", {}).setdefault("securitySchemes", {})["BearerAuth"] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "在此填入登录返回的 access_token，格式：Bearer {token}",
        }
        schema["security"] = [{"BearerAuth": []}]
        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = custom_openapi
    return app
