"""Add username column to dialogue_logs table

Revision ID: 9a1b2c3d4e5f
Revises: 8f0a2b7c6d5e
Create Date: 2024-12-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a1b2c3d4e5f'
down_revision: Union[str, None] = '8f0a2b7c6d5e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add username column to dialogue_logs table."""
    op.add_column(
        'dialogue_logs',
        sa.Column(
            'username',
            sa.String(64),
            nullable=True,
            comment='Username of who initiated the dialogue',
        )
    )
    op.create_index(
        'ix_dialogue_logs_username',
        'dialogue_logs',
        ['username'],
    )


def downgrade() -> None:
    """Remove username column from dialogue_logs table."""
    op.drop_index('ix_dialogue_logs_username', table_name='dialogue_logs')
    op.drop_column('dialogue_logs', 'username')
