"""user_notification_reads — cross-device inbox read state

Revision ID: 011_notification_reads
Revises: 010_notifications
Create Date: 2026-08-05
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011_notification_reads"
down_revision: Union[str, None] = "010_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_notification_reads",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["notification_campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "campaign_id"),
    )
    op.create_index(
        "ix_user_notification_reads_campaign_id",
        "user_notification_reads",
        ["campaign_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_notification_reads_campaign_id", table_name="user_notification_reads")
    op.drop_table("user_notification_reads")
