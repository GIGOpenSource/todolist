"""管理端列表与统计的平台、地区、语言及日期筛选。"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Query

from models.user import User
from utils.time_util import utc_day_bounds, utc_ts_bounds

PLATFORMS = ("ios", "android", "web", "pc", "unknown")


def parse_date(value: Optional[str]) -> Optional[date]:
    """解析 ISO 日期，空值或非法值返回空。"""

    raw = (value or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def normalize_platform(value: Optional[str]) -> str:
    """将常见客户端平台别名归一化。"""

    p = (value or "").strip().lower()
    if p in PLATFORMS:
        return p
    # aliases
    if p in ("iphone", "ipad", "iosphone", "iospad"):
        return "ios"
    if p in ("androidphone", "androidpad"):
        return "android"
    if p in ("h5", "browser"):
        return "web"
    if p in ("desktop", "macos", "windows", "linux"):
        return "pc"
    return ""


def normalize_country(value: Optional[str]) -> str:
    """规范国家代码并兼容历史自由文本。"""
    return (value or "").strip()[:64]


def normalize_language(value: Optional[str]) -> str:
    """规范 BCP 47 风格的语言标签。"""
    return (value or "").strip().replace("_", "-")[:32]


def day_bounds(d: date) -> Tuple[datetime, datetime]:
    """返回管理端 UTC 自然日边界。"""
    return utc_day_bounds(d)


def ts_bounds(d: date) -> Tuple[float, float]:
    """返回 UTC 自然日的 Unix 秒时间戳边界。"""
    return utc_ts_bounds(d)


class AdminFilters:
    """封装管理端公共筛选条件及查询应用逻辑。"""

    def __init__(
        self,
        *,
        platform: str = "",
        country: str = "",
        language: str = "",
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ):
        self.platform = normalize_platform(platform)
        self.country = normalize_country(country)
        self.language = normalize_language(language)
        self.date_from = parse_date(date_from)
        self.date_to = parse_date(date_to)
        if self.date_from and self.date_to and self.date_from > self.date_to:
            self.date_from, self.date_to = self.date_to, self.date_from

    @property
    def active(self) -> bool:
        return bool(
            self.platform or self.country or self.language or self.date_from or self.date_to
        )

    def apply_user_attrs(self, query: Query, user_model=User) -> Query:
        """Filter by user platform / country / device language."""
        if self.platform:
            query = query.filter(user_model.register_platform == self.platform)
        if self.country:
            c = self.country
            # ISO2: exact / prefix; otherwise soft contains (legacy free text)
            if len(c) == 2 and c.isalpha():
                query = query.filter(
                    or_(
                        user_model.register_region.ilike(c),
                        user_model.register_region.ilike(f"{c}-%"),
                        user_model.register_region.ilike(f"{c}_%"),
                    )
                )
            else:
                query = query.filter(user_model.register_region.ilike(f"%{c}%"))
        if self.language:
            lang = self.language
            # Match exact or prefix: zh → zh / zh-CN / zh-Hans
            query = query.filter(
                or_(
                    user_model.device_language.ilike(lang),
                    user_model.device_language.ilike(f"{lang}-%"),
                    user_model.device_language.ilike(f"{lang}_%"),
                )
            )
        return query

    def apply_user_created(self, query: Query, user_model=User) -> Query:
        """按用户属性与注册日期筛选查询。"""

        query = self.apply_user_attrs(query, user_model)
        if self.date_from:
            query = query.filter(user_model.created_at >= day_bounds(self.date_from)[0])
        if self.date_to:
            query = query.filter(user_model.created_at <= day_bounds(self.date_to)[1])
        return query

    def datetime_range(self) -> Tuple[Optional[datetime], Optional[datetime]]:
        """返回筛选条件对应的日期时间范围。"""

        start = day_bounds(self.date_from)[0] if self.date_from else None
        end = day_bounds(self.date_to)[1] if self.date_to else None
        return start, end

    def ts_range(self) -> Tuple[Optional[float], Optional[float]]:
        """返回筛选条件对应的毫秒时间戳范围。"""

        start = ts_bounds(self.date_from)[0] if self.date_from else None
        end = ts_bounds(self.date_to)[1] if self.date_to else None
        return start, end

    def to_dict(self) -> dict:
        """序列化为管理端响应字段。"""

        return {
            "platform": self.platform or "",
            "country": self.country or "",
            "language": self.language or "",
            "dateFrom": self.date_from.isoformat() if self.date_from else "",
            "dateTo": self.date_to.isoformat() if self.date_to else "",
        }
