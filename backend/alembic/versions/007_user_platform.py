"""users.register_platform

Revision ID: 007_user_platform
Revises: 006_site_config
Create Date: 2026-08-04
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_user_platform"
down_revision: Union[str, None] = "006_site_config"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("register_platform", sa.String(length=32), nullable=False, server_default=""),
    )
    op.create_index("ix_users_register_platform", "users", ["register_platform"])


def downgrade() -> None:
    op.drop_index("ix_users_register_platform", table_name="users")
    op.drop_column("users", "register_platform")
