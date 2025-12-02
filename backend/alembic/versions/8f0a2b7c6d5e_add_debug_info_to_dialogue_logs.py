"""Add debug_info column to dialogue_logs table

Revision ID: 8f0a2b7c6d5e
Revises: 7e9f1a6b5c4d
Create Date: 2024-12-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = '8f0a2b7c6d5e'
down_revision: Union[str, None] = '7e9f1a6b5c4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add debug_info JSONB column to dialogue_logs table."""
    op.add_column(
        'dialogue_logs',
        sa.Column(
            'debug_info',
            JSONB,
            nullable=False,
            server_default='{}',
            comment='Algorithm debug information (threshold, candidates, excluded, etc.)',
        )
    )


def downgrade() -> None:
    """Remove debug_info column from dialogue_logs table."""
    op.drop_column('dialogue_logs', 'debug_info')
