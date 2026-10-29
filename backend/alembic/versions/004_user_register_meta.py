"""users.register_method / register_region

Revision ID: 004_user_register_meta
Revises: 003_admin_panel
Create Date: 2026-08-04
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_user_register_meta"
down_revision: Union[str, None] = "003_admin_panel"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("register_method", sa.String(length=32), nullable=False, server_default="password"),
    )
    op.add_column(
        "users",
        sa.Column("register_region", sa.String(length=64), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("users", "register_region")
    op.drop_column("users", "register_method")
