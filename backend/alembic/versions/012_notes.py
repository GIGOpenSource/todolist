"""notes table + sync_meta.notes_list_updated_at

Revision ID: 012_notes
Revises: 011_notification_reads
Create Date: 2026-08-06
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012_notes"
down_revision: Union[str, None] = "011_notification_reads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notes",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notes_user_id", "notes", ["user_id"])
    op.create_index("ix_notes_user_updated", "notes", ["user_id", "updated_at"])
    op.create_index("ix_notes_user_created", "notes", ["user_id", "created_at"])

    op.add_column(
        "sync_meta",
        sa.Column("notes_list_updated_at", sa.Float(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("sync_meta", "notes_list_updated_at")
    op.drop_index("ix_notes_user_created", table_name="notes")
    op.drop_index("ix_notes_user_updated", table_name="notes")
    op.drop_index("ix_notes_user_id", table_name="notes")
    op.drop_table("notes")
