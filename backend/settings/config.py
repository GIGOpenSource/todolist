"""Settings 基类与 get_settings；生产校验密钥强度。"""

from __future__ import annotations

import os
import re
from functools import lru_cache
from pathlib import Path
from typing import List
from urllib.parse import urlparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Values that must never ship in production
_INSECURE_SECRETS = {
    "",
    "todolist-dev-secret-change-in-production",
    "CHANGE_ME_IN_PRODUCTION",
    "change-me",
    "secret",
}
_INSECURE_ADMIN_PASSWORDS = {"", "admin123456", "admin", "password", "123456"}

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_LOCAL_DB_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


def _database_host(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    if raw.startswith("sqlite"):
        return "sqlite"
    # SQLAlchemy may use postgresql+psycopg://...
    normalized = re.sub(r"^([a-z0-9+]+)\+", r"\1", raw, count=1, flags=re.I)
    try:
        return (urlparse(normalized).hostname or "").lower()
    except Exception:
        return ""


class Settings(BaseSettings):
    """应用基础配置，所有时间统一使用 UTC。"""

    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Upgrade API"
    app_version: str = "1.1.0"
    env: str = "dev"
    debug: bool = True

    secret_key: str = "todolist-dev-secret-change-in-production"
    algorithm: str = "HS256"
    # Access token TTL (minutes). Dev default ~30d; pro should set 120 (2h) + refresh.
    access_token_expire_minutes: int = 60 * 24 * 30
    refresh_token_expire_days: int = 30

    # Must come from backend/.env (or process env). No local sqlite default.
    database_url: str = ""
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_recycle: int = 1800

    default_locale: str = "en"
    supported_locales: tuple[str, ...] = ("zh", "en", "ko")

    admin_username: str = "admin"
    admin_password: str = "admin123456"

    cors_origins: List[str] = Field(default_factory=lambda: ["*"])

    log_dir: str = str(_BACKEND_ROOT / "logs")
    log_level: str = "INFO"
    log_request_bodies: bool = False

    # Rate limits (requests per window)
    rate_limit_auth_per_minute: int = 10
    rate_limit_sync_per_minute: int = 60
    rate_limit_report_per_minute: int = 10

    # Background purge interval (seconds); 0 disables loop (still purge on startup)
    account_purge_interval_seconds: int = 3600

    # Redis (optional; memory fallback when empty)
    redis_url: str = ""

    # OpenAI-compatible LLM（可选；未配置时使用本地模板生成汇报）
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 60.0

    # S3-compatible object storage for avatars (optional)
    oss_endpoint: str = ""
    oss_endpoint_public: str = ""  # External-facing endpoint for presigned URLs (browser-accessible)
    oss_bucket: str = ""
    oss_access_key: str = ""
    oss_secret_key: str = ""
    oss_region: str = "us-east-1"
    oss_public_base_url: str = ""
    oss_prefix: str = "avatars/"
    # Max data-URL chars when OSS disabled
    max_avatar_data_url_chars: int = 600_000
    # When OSS enabled, reject data URLs larger than this (force upload)
    max_avatar_inline_chars: int = 0

    report_job_poll_seconds: float = 1.0
    report_queue_key: str = "queue:report_jobs"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, v):
        if v is None or v == "":
            return ["*"]
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("["):
                import json

                return json.loads(s)
            return [p.strip() for p in s.split(",") if p.strip()]
        return v

    def validate_for_runtime(self) -> None:
        """启动前校验：强制远程 Postgres（.env），拒绝本机/sqlite。"""
        allow_local_db = os.getenv("ALLOW_LOCAL_DB") == "1"
        db_url = (self.database_url or "").strip()
        if not db_url:
            raise RuntimeError(
                "DATABASE_URL is required. Set it in backend/.env to the remote Postgres DSN."
            )
        host = _database_host(db_url)
        if db_url.startswith("sqlite") or host == "sqlite":
            if not allow_local_db:
                raise RuntimeError(
                    "SQLite is disabled for this project. "
                    "Use remote Postgres via DATABASE_URL in backend/.env "
                    "(set ALLOW_LOCAL_DB=1 only for emergency local tests)."
                )
        elif not allow_local_db and host in _LOCAL_DB_HOSTS:
            raise RuntimeError(
                f"Local database host '{host}' is forbidden. "
                "Point DATABASE_URL in backend/.env to the remote Postgres "
                "(set ALLOW_LOCAL_DB=1 only for emergency local tests)."
            )
        elif not db_url.startswith(("postgresql", "postgres")):
            raise RuntimeError(
                "DATABASE_URL must be a Postgres DSN (postgresql+psycopg://...)."
            )

        if self.env not in ("pro", "prod", "production"):
            return
        if self.secret_key.strip() in _INSECURE_SECRETS or len(self.secret_key.strip()) < 32:
            raise RuntimeError(
                "Production requires a strong SECRET_KEY (env SECRET_KEY, min 32 chars)."
            )
        if self.admin_password.strip() in _INSECURE_ADMIN_PASSWORDS:
            raise RuntimeError(
                "Production requires ADMIN_PASSWORD to be set to a non-default value."
            )
        if not self.cors_origins or "*" in self.cors_origins:
            raise RuntimeError(
                "Production forbids CORS=* ; set CORS_ORIGINS to an explicit whitelist."
            )
        try:
            concurrency = int(os.getenv("WEB_CONCURRENCY") or "1")
        except ValueError:
            concurrency = 1
        if concurrency > 1 and not (self.redis_url or "").strip():
            raise RuntimeError(
                "Production multi-worker (WEB_CONCURRENCY>1) requires REDIS_URL "
                "for shared sessions, rate limits, and report jobs."
            )


@lru_cache
def get_settings() -> Settings:
    """根据 APP_ENV 或 ENV 加载开发或生产配置。"""
    from settings.dev import DevSettings
    from settings.pro import ProSettings

    env = (os.getenv("APP_ENV") or os.getenv("ENV") or "").lower()
    if not env:
        # Fall back to backend/.env so APP_ENV=pro is honored without shell export.
        try:
            for line in (_BACKEND_ROOT / ".env").read_text(encoding="utf-8").splitlines():
                s = line.strip()
                if not s or s.startswith("#") or "=" not in s:
                    continue
                key, val = s.split("=", 1)
                if key.strip() in ("APP_ENV", "ENV"):
                    env = val.strip().strip('"').strip("'").lower()
                    break
        except OSError:
            env = ""
    if not env:
        env = "dev"
    if env in ("pro", "prod", "production"):
        return ProSettings()
    return DevSettings()
