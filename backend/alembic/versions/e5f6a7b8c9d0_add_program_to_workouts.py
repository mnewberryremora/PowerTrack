"""add program_id and program_day_index to workouts

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('workouts', sa.Column('program_id', sa.Integer(), sa.ForeignKey('programs.id', ondelete='SET NULL'), nullable=True))
    op.add_column('workouts', sa.Column('program_day_index', sa.SmallInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column('workouts', 'program_day_index')
    op.drop_column('workouts', 'program_id')
