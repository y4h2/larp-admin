"""Enable realtime for collaborative editing

Revision ID: 6d8e0f5a4b3c
Revises: 5c7d9e4f3a2b
Create Date: 2024-01-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '6d8e0f5a4b3c'
down_revision: Union[str, None] = '5c7d9e4f3a2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tables to enable realtime for
REALTIME_TABLES = ['scripts', 'npcs', 'clues']


def upgrade() -> None:
    """Enable Supabase Realtime on scripts, npcs, and clues tables."""
    for table in REALTIME_TABLES:
        # Add table to supabase realtime publication
        op.execute(f"""
            ALTER PUBLICATION supabase_realtime ADD TABLE {table};
        """)


def downgrade() -> None:
    """Disable Supabase Realtime on scripts, npcs, and clues tables."""
    for table in REALTIME_TABLES:
        # Remove table from supabase realtime publication
        op.execute(f"""
            ALTER PUBLICATION supabase_realtime DROP TABLE {table};
        """)
