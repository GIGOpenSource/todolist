"""admin panel tables: login days, site visits, llm configs

Revision ID: 003_admin_panel
Revises: 002_report_jobs
Create Date: 2026-08-04
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_admin_panel"
down_revision: Union[str, None] = "002_report_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_login_days",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("login_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "login_date", name="uq_user_login_day"),
    )
    op.create_index("ix_user_login_days_user_id", "user_login_days", ["user_id"])
    op.create_index("ix_user_login_days_login_date", "user_login_days", ["login_date"])

    op.create_table(
        "site_visits",
        sa.Column("visit_date", sa.Date(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("visit_date"),
    )

    op.create_table(
        "llm_model_configs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("base_url", sa.String(length=512), nullable=False),
        sa.Column("api_key", sa.Text(), nullable=False),
        sa.Column("model", sa.String(length=128), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("remark", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_llm_model_configs_is_default", "llm_model_configs", ["is_default"])


def downgrade() -> None:
    op.drop_index("ix_llm_model_configs_is_default", table_name="llm_model_configs")
    op.drop_table("llm_model_configs")
    op.drop_table("site_visits")
    op.drop_index("ix_user_login_days_login_date", table_name="user_login_days")
    op.drop_index("ix_user_login_days_user_id", table_name="user_login_days")
    op.drop_table("user_login_days")
