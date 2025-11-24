"""add prereq_clue_ids to clues

Revision ID: add_prereq_clues
Revises: acbf0b5fb934
Create Date: 2025-11-23 22:05:31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_prereq_clues'
down_revision: Union[str, None] = 'acbf0b5fb934'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add prereq_clue_ids column to clues table
    op.add_column(
        'clues',
        sa.Column(
            'prereq_clue_ids',
            postgresql.ARRAY(sa.UUID(as_uuid=False)),
            nullable=False,
            server_default='{}',
            comment='Prerequisite clue IDs for dependency tree'
        )
    )


def downgrade() -> None:
    # Remove prereq_clue_ids column
    op.drop_column('clues', 'prereq_clue_ids')
