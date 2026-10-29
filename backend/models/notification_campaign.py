"""临时通知活动（campaign）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base
from utils.time_util import utc_now


class NotificationCampaign(Base):
    """Admin-defined temporary / custom notification (not rule-based)."""

    __tablename__ = "notification_campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # system | promo (promo requires explicit opt-in; due/streak/report reserved for rules)
    channel: Mapped[str] = mapped_column(String(32), nullable=False, default="system", index=True)
    # draft | scheduled | active | ended | cancelled
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft", index=True)
    # all | ios | android | web | pc  (comma-separated multi ok stored as JSON list string)
    platforms: Mapped[str] = mapped_column(String(128), nullable=False, default="all")
    start_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    end_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    # If true, may bypass quiet hours (only allowed for channel=system)
    bypass_quiet: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    remark: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
