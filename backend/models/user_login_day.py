"""用户打开应用的 UTC 日历日（连续天数 / DAU）。"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base
from utils.time_util import utc_now


class UserLoginDay(Base):
    """One row per user per UTC calendar day they successfully logged in (DAU)."""

    __tablename__ = "user_login_days"
    __table_args__ = (UniqueConstraint("user_id", "login_date", name="uq_user_login_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    login_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
