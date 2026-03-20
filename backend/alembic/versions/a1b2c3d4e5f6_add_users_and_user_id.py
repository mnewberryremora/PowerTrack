"""add users table and user_id to all tables

Revision ID: a1b2c3d4e5f6
Revises: 43950b6fd0fc
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '43950b6fd0fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # Helper: add nullable user_id, then make NOT NULL after setting server_default
    # For a fresh DB this is not needed, but handles existing data safely.
    tables = [
        'workouts',
        'body_metrics',
        'meets',
        'programs',
        'ai_conversations',
        'personal_records',
    ]
    for table in tables:
        op.add_column(table, sa.Column('user_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            f'fk_{table}_user_id', table, 'users', ['user_id'], ['id'],
            ondelete='CASCADE',
        )
        op.create_index(f'ix_{table}_user_id', table, ['user_id'])

    # user_preferences: add user_id as unique FK
    op.add_column('user_preferences', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_user_preferences_user_id', 'user_preferences', 'users', ['user_id'], ['id'],
        ondelete='CASCADE',
    )
    op.create_index('ix_user_preferences_user_id', 'user_preferences', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_user_preferences_user_id', 'user_preferences')
    op.drop_constraint('fk_user_preferences_user_id', 'user_preferences', type_='foreignkey')
    op.drop_column('user_preferences', 'user_id')

    tables = [
        'workouts', 'body_metrics', 'meets', 'programs',
        'ai_conversations', 'personal_records',
    ]
    for table in tables:
        op.drop_index(f'ix_{table}_user_id', table)
        op.drop_constraint(f'fk_{table}_user_id', table, type_='foreignkey')
        op.drop_column(table, 'user_id')

    op.drop_index('ix_users_email', 'users')
    op.drop_table('users')
