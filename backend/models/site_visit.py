"""官网访问埋点按 UTC 日维度累计。"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base
from utils.time_util import utc_now


class SiteVisit(Base):
    """Website visit counter keyed by UTC date + platform + country."""

    __tablename__ = "site_visits"
    __table_args__ = (PrimaryKeyConstraint("visit_date", "platform", "country"),)

    visit_date: Mapped[date] = mapped_column(Date, nullable=False)
    platform: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    country: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
