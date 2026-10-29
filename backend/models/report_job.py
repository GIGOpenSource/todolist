"""异步汇报任务状态。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base
from utils.time_util import utc_now


class ReportJob(Base):
    __tablename__ = "report_jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="queued", nullable=False, index=True)
    # queued | running | done | failed
    locale: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    nickname: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    streak_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    start_at: Mapped[float] = mapped_column(Float, nullable=False)
    end_at: Mapped[float] = mapped_column(Float, nullable=False)
    request_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    task_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pending_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
