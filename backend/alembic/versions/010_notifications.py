"""notification_configs + notification_campaigns

Revision ID: 010_notifications
Revises: 009_user_language
Create Date: 2026-08-04
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010_notifications"
down_revision: Union[str, None] = "009_user_language"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification_configs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("config_json", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "notification_campaigns",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("platforms", sa.String(length=128), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bypass_quiet", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("remark", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("created_by", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notification_campaigns_channel", "notification_campaigns", ["channel"])
    op.create_index("ix_notification_campaigns_status", "notification_campaigns", ["status"])
    op.create_index("ix_notification_campaigns_start_at", "notification_campaigns", ["start_at"])
    op.create_index("ix_notification_campaigns_end_at", "notification_campaigns", ["end_at"])


def downgrade() -> None:
    op.drop_index("ix_notification_campaigns_end_at", table_name="notification_campaigns")
    op.drop_index("ix_notification_campaigns_start_at", table_name="notification_campaigns")
    op.drop_index("ix_notification_campaigns_status", table_name="notification_campaigns")
    op.drop_index("ix_notification_campaigns_channel", table_name="notification_campaigns")
    op.drop_table("notification_campaigns")
    op.drop_table("notification_configs")
