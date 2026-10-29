"""结构化日志：UTC 时间戳、滚动文件与控制台；禁止业务代码使用 print。

日志格式自动附加当前请求的 request_id（来自 ContextVar）。
"""

from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

from settings.config import get_settings

_INITIALIZED = False


class UtcFormatter(logging.Formatter):
    """强制日志时间为 UTC ISO-8601，并注入 request_id。"""

    def formatTime(self, record, datefmt=None):  # noqa: N802
        dt = datetime.fromtimestamp(record.created, tz=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    def format(self, record):
        if not hasattr(record, "request_id"):
            try:
                from common.request_context import get_request_id

                record.request_id = get_request_id()
            except Exception:  # noqa: BLE001
                record.request_id = "-"
        return super().format(record)


def setup_logging() -> None:
    """幂等初始化根日志配置。"""
    global _INITIALIZED
    if _INITIALIZED:
        return

    settings = get_settings()
    log_dir = Path(settings.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))

    formatter = UtcFormatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | rid=%(request_id)s | %(message)s"
    )

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    root.addHandler(console)

    file_handler = RotatingFileHandler(
        log_dir / "app.log",
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    # Silence noisy libs a bit
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    _INITIALIZED = True


def get_logger(name: str) -> logging.Logger:
    """获取已完成全局配置的命名日志器。"""

    if not _INITIALIZED:
        setup_logging()
    return logging.getLogger(name)
