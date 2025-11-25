"""add new schema fields from data model

Revision ID: add_new_schema_fields
Revises: add_prereq_clues
Create Date: 2025-11-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_new_schema_fields'
down_revision: Union[str, None] = 'add_prereq_clues'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to scripts table
    op.add_column(
        'scripts',
        sa.Column(
            'summary',
            sa.Text(),
            nullable=True,
            comment='Brief summary of the script story'
        )
    )
    op.add_column(
        'scripts',
        sa.Column(
            'background',
            sa.Text(),
            nullable=True,
            comment='Background setting and context for the story'
        )
    )
    op.add_column(
        'scripts',
        sa.Column(
            'truth',
            postgresql.JSONB(),
            nullable=False,
            server_default='{}',
            comment='The truth of the case: murderer, weapon, motive, crime_method'
        )
    )

    # Add knowledge_scope column to npcs table
    op.add_column(
        'npcs',
        sa.Column(
            'knowledge_scope',
            postgresql.JSONB(),
            nullable=False,
            server_default='{}',
            comment='NPC knowledge scope: knows, does_not_know, world_model_limits'
        )
    )

    # Add detail_for_npc column to clues table
    op.add_column(
        'clues',
        sa.Column(
            'detail_for_npc',
            sa.Text(),
            nullable=True,
            comment='Guidance for NPC on how to reveal this clue'
        )
    )


def downgrade() -> None:
    # Remove columns in reverse order
    op.drop_column('clues', 'detail_for_npc')
    op.drop_column('npcs', 'knowledge_scope')
    op.drop_column('scripts', 'truth')
    op.drop_column('scripts', 'background')
    op.drop_column('scripts', 'summary')
