"""endurance and user approval

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add status and is_admin columns to users table
    op.add_column("users", sa.Column("status", sa.String(20), nullable=False, server_default="approved"))
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))

    # Create endurance_activities table
    op.create_table(
        "endurance_activities",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column("activity_type", sa.String(20), nullable=False),
        sa.Column("sub_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("distance_m", sa.Float(), nullable=True),
        sa.Column("duration_s", sa.Integer(), nullable=True),
        sa.Column("avg_heart_rate", sa.Integer(), nullable=True),
        sa.Column("avg_split_500m_s", sa.Integer(), nullable=True),
        sa.Column("stroke_rate", sa.Float(), nullable=True),
        sa.Column("calories", sa.Integer(), nullable=True),
        sa.Column("is_competition", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("competition_name", sa.String(200), nullable=True),
        sa.Column("competition_type", sa.String(100), nullable=True),
        sa.Column("place", sa.Integer(), nullable=True),
        sa.Column("notes", sa.String(2000), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_endurance_activities_user_id", "endurance_activities", ["user_id"])
    op.create_index("ix_endurance_activities_activity_date", "endurance_activities", ["activity_date"])


def downgrade() -> None:
    op.drop_index("ix_endurance_activities_activity_date", table_name="endurance_activities")
    op.drop_index("ix_endurance_activities_user_id", table_name="endurance_activities")
    op.drop_table("endurance_activities")

    op.drop_column("users", "is_admin")
    op.drop_column("users", "status")
