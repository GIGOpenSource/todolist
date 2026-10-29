"""users.admin_permissions

Revision ID: 005_admin_permissions
Revises: 004_user_register_meta
Create Date: 2026-08-04
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_admin_permissions"
down_revision: Union[str, None] = "004_user_register_meta"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("admin_permissions", sa.Text(), nullable=False, server_default="*"),
    )


def downgrade() -> None:
    op.drop_column("users", "admin_permissions")
