"""todos.is_deleted + notes.is_deleted — soft-delete for LWW sync

Revision ID: 013_is_deleted
Revises: 012_notes
Create Date: 2026-08-06
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013_is_deleted"
down_revision: Union[str, None] = "012_notes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "todos",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_todos_user_deleted_updated", "todos", ["user_id", "is_deleted", "updated_at"])

    op.add_column(
        "notes",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_notes_user_deleted_updated", "notes", ["user_id", "is_deleted", "updated_at"])


def downgrade() -> None:
    op.drop_index("ix_notes_user_deleted_updated", table_name="notes")
    op.drop_column("notes", "is_deleted")
    op.drop_index("ix_todos_user_deleted_updated", table_name="todos")
    op.drop_column("todos", "is_deleted")
