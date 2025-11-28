"""Add RLS policies for PostgREST access.

Revision ID: 4b6c9d3e2f1a
Revises: 3a5f8c9d2e1b
Create Date: 2024-11-27

This migration:
1. Enables RLS on tables accessed via PostgREST
2. Adds policies for anon role to access data
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4b6c9d3e2f1a"
down_revision: str | None = "3a5f8c9d2e1b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# All tables that need RLS policies
ALL_TABLES = ["llm_configs", "prompt_templates", "scripts", "npcs", "clues", "dialogue_logs"]


def upgrade() -> None:
    """Enable RLS and add policies for PostgREST access."""

    for table in ALL_TABLES:
        # Enable RLS
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

        # SELECT: Allow reading
        op.execute(f"""
            CREATE POLICY "{table}_anon_select" ON {table}
            FOR SELECT TO anon
            USING (true)
        """)

        # INSERT: Allow all inserts
        op.execute(f"""
            CREATE POLICY "{table}_anon_insert" ON {table}
            FOR INSERT TO anon
            WITH CHECK (true)
        """)

        # UPDATE: Allow updating any record
        op.execute(f"""
            CREATE POLICY "{table}_anon_update" ON {table}
            FOR UPDATE TO anon
            USING (true)
            WITH CHECK (true)
        """)

        # DELETE: Allow hard delete
        op.execute(f"""
            CREATE POLICY "{table}_anon_delete" ON {table}
            FOR DELETE TO anon
            USING (true)
        """)


def downgrade() -> None:
    """Remove RLS policies and disable RLS."""

    for table in ALL_TABLES:
        # Drop policies
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_select" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_insert" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_update" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_delete" ON {table}')

        # Disable RLS
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
