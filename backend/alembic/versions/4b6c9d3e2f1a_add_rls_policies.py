"""Add RLS policies for PostgREST access.

Revision ID: 4b6c9d3e2f1a
Revises: 3a5f8c9d2e1b
Create Date: 2024-11-27

This migration:
1. Enables RLS on tables accessed via PostgREST
2. Adds policies for anon role to access data
3. SELECT policies automatically filter soft-deleted records (deleted_at IS NULL)
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4b6c9d3e2f1a"
down_revision: str | None = "3a5f8c9d2e1b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables with soft delete (have deleted_at column)
SOFT_DELETE_TABLES = ["llm_configs", "prompt_templates", "scripts", "npcs", "clues"]

# Tables without soft delete
NO_SOFT_DELETE_TABLES = ["dialogue_logs"]


def upgrade() -> None:
    """Enable RLS and add policies for PostgREST access."""

    # Tables with soft delete - SELECT filters deleted records automatically
    for table in SOFT_DELETE_TABLES:
        # Enable RLS
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

        # SELECT: Only return non-deleted records
        op.execute(f"""
            CREATE POLICY "{table}_anon_select" ON {table}
            FOR SELECT TO anon
            USING (deleted_at IS NULL)
        """)

        # INSERT: Allow all inserts
        op.execute(f"""
            CREATE POLICY "{table}_anon_insert" ON {table}
            FOR INSERT TO anon
            WITH CHECK (true)
        """)

        # UPDATE: Allow updating any record (including soft-deleted for restore)
        op.execute(f"""
            CREATE POLICY "{table}_anon_update" ON {table}
            FOR UPDATE TO anon
            USING (true)
            WITH CHECK (true)
        """)

        # DELETE: Allow hard delete (though we use soft delete)
        op.execute(f"""
            CREATE POLICY "{table}_anon_delete" ON {table}
            FOR DELETE TO anon
            USING (true)
        """)

    # Tables without soft delete - full access
    for table in NO_SOFT_DELETE_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

        op.execute(f"""
            CREATE POLICY "{table}_anon_select" ON {table}
            FOR SELECT TO anon
            USING (true)
        """)

        op.execute(f"""
            CREATE POLICY "{table}_anon_insert" ON {table}
            FOR INSERT TO anon
            WITH CHECK (true)
        """)

        op.execute(f"""
            CREATE POLICY "{table}_anon_update" ON {table}
            FOR UPDATE TO anon
            USING (true)
            WITH CHECK (true)
        """)

        op.execute(f"""
            CREATE POLICY "{table}_anon_delete" ON {table}
            FOR DELETE TO anon
            USING (true)
        """)


def downgrade() -> None:
    """Remove RLS policies and disable RLS."""

    all_tables = SOFT_DELETE_TABLES + NO_SOFT_DELETE_TABLES

    for table in all_tables:
        # Drop policies
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_select" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_insert" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_update" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_delete" ON {table}')

        # Disable RLS
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
