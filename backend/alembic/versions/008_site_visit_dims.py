"""site_visits dimensional PK (platform, country)

Revision ID: 008_site_visit_dims
Revises: 007_user_platform
Create Date: 2026-08-04
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_site_visit_dims"
down_revision: Union[str, None] = "007_user_platform"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table("site_visits", "site_visits_old")
    op.create_table(
        "site_visits",
        sa.Column("visit_date", sa.Date(), nullable=False),
        sa.Column("platform", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("country", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("visit_date", "platform", "country"),
    )
    op.execute(
        """
        INSERT INTO site_visits (visit_date, platform, country, count, updated_at)
        SELECT visit_date, '', '', count, updated_at FROM site_visits_old
        """
    )
    op.drop_table("site_visits_old")


def downgrade() -> None:
    op.rename_table("site_visits", "site_visits_new")
    op.create_table(
        "site_visits",
        sa.Column("visit_date", sa.Date(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("visit_date"),
    )
    op.execute(
        """
        INSERT INTO site_visits (visit_date, count, updated_at)
        SELECT visit_date, SUM(count), MAX(updated_at)
        FROM site_visits_new
        GROUP BY visit_date
        """
    )
    op.drop_table("site_visits_new")
