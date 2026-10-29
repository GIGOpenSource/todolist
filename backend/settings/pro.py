"""Production environment overrides."""

from settings.config import Settings


class ProSettings(Settings):
    env: str = "pro"
    debug: bool = False
    log_level: str = "INFO"
    log_request_bodies: bool = False
    # Must be overridden via env — empty defaults fail validate_for_runtime()
    secret_key: str = ""
    admin_password: str = ""
    cors_origins: list[str] = []
    # Prefer short-lived access tokens in production (pair with refresh)
    access_token_expire_minutes: int = 120
    db_pool_size: int = 10
    db_max_overflow: int = 20
