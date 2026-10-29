"""用户通知已读状态。"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base
from utils.time_util import utc_now


class UserNotificationRead(Base):
    """Per-user read receipt for a notification campaign."""

    __tablename__ = "user_notification_reads"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    campaign_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("notification_campaigns.id", ondelete="CASCADE"),
        primary_key=True,
    )
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
