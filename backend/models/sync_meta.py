"""用户级同步元数据（list_updated_at）。"""

from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class SyncMeta(Base):
    """List-level timestamp for last-write-wins sync (UTC epoch)."""

    __tablename__ = "sync_meta"

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), primary_key=True)
    list_updated_at: Mapped[float] = mapped_column(Float, default=0.0)
    notes_list_updated_at: Mapped[float] = mapped_column(Float, default=0.0)

    owner = relationship("User", back_populates="sync_meta")
