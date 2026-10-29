"""Development environment overrides."""

from settings.config import Settings


class DevSettings(Settings):
    env: str = "dev"
    debug: bool = True
    log_level: str = "DEBUG"
    log_request_bodies: bool = False
