"""用户 ORM：账号、角色、资料、软删与管理员权限。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from common.constants import ROLE_USER
from utils.time_util import utc_now
from core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    nickname: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    avatar: Mapped[str] = mapped_column(Text, default="", nullable=False)
    signature: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    gender: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), default=ROLE_USER, nullable=False, index=True)
    # Registration meta (admin user management)
    register_method: Mapped[str] = mapped_column(String(32), default="password", nullable=False)
    register_region: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    # ios | android | web | pc | unknown
    register_platform: Mapped[str] = mapped_column(String(32), default="", nullable=False, index=True)
    # Device / system language at first login (e.g. zh-CN, en-US)
    device_language: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    # Admin only: JSON list or "*" for full access. Empty treated as "*" for legacy admins.
    admin_permissions: Mapped[str] = mapped_column(Text, default="*", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    # Soft-delete: set on schedule; hard-purged after ACCOUNT_DELETION_GRACE_DAYS
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    todos = relationship("Todo", back_populates="owner", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="owner", cascade="all, delete-orphan")
    sync_meta = relationship(
        "SyncMeta",
        back_populates="owner",
        uselist=False,
        cascade="all, delete-orphan",
    )
