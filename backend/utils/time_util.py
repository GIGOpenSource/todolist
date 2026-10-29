"""时间工具：存储与业务日历日一律 UTC。"""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Tuple

UTC = timezone.utc


def utc_now() -> datetime:
    """返回带时区的 UTC 当前时间（入库时间戳用）。"""
    return datetime.now(UTC)


def utc_today() -> date:
    """UTC 日历日（管理端统计 / DAU / 官网访问按日）。"""
    return utc_now().date()


def utc_day_bounds(d: date) -> Tuple[datetime, datetime]:
    """UTC 日历日的起止时刻（aware），便于与时刻字段比较。"""
    start = datetime.combine(d, time.min, tzinfo=UTC)
    end = datetime.combine(d, time.max, tzinfo=UTC)
    return start, end


def utc_ts_bounds(d: date) -> Tuple[float, float]:
    """UTC 日历日的 Unix 秒时间戳边界。"""
    start, end = utc_day_bounds(d)
    return start.timestamp(), end.timestamp()


def as_utc(dt: datetime | None) -> datetime | None:
    """Normalize DB/ISO datetimes to aware UTC (SQLite often returns naive)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def utc_now_iso() -> str:
    """UTC 当前时间的 ISO-8601 字符串（毫秒 + Z）。"""
    return utc_now().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def utc_now_ts() -> float:
    """UTC 当前时间的 Unix 时间戳（秒）。"""
    return utc_now().timestamp()
