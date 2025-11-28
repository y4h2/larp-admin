"""Update RLS policies to use authenticated role.

Revision ID: 5c7d9e4f3a2b
Revises: 4b6c9d3e2f1a
Create Date: 2024-11-27

This migration:
1. Removes anon role policies
2. Adds authenticated role policies
3. Ensures only logged-in users can access data
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5c7d9e4f3a2b"
down_revision: str | None = "4b6c9d3e2f1a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# All tables that need RLS policies
ALL_TABLES = ["llm_configs", "prompt_templates", "scripts", "npcs", "clues", "dialogue_logs"]


def upgrade() -> None:
    """Update RLS policies from anon to authenticated role."""

    # Drop all anon policies
    for table in ALL_TABLES:
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_select" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_insert" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_update" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_delete" ON {table}')

    # Create authenticated policies for all tables
    for table in ALL_TABLES:
        # SELECT: Allow authenticated users to read
        op.execute(f"""
            CREATE POLICY "{table}_auth_select" ON {table}
            FOR SELECT TO authenticated
            USING (true)
        """)

        # INSERT: Allow all inserts for authenticated users
        op.execute(f"""
            CREATE POLICY "{table}_auth_insert" ON {table}
            FOR INSERT TO authenticated
            WITH CHECK (true)
        """)

        # UPDATE: Allow updating any record for authenticated users
        op.execute(f"""
            CREATE POLICY "{table}_auth_update" ON {table}
            FOR UPDATE TO authenticated
            USING (true)
            WITH CHECK (true)
        """)

        # DELETE: Allow hard delete for authenticated users
        op.execute(f"""
            CREATE POLICY "{table}_auth_delete" ON {table}
            FOR DELETE TO authenticated
            USING (true)
        """)


def downgrade() -> None:
    """Revert to anon role policies."""

    # Drop authenticated policies
    for table in ALL_TABLES:
        op.execute(f'DROP POLICY IF EXISTS "{table}_auth_select" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_auth_insert" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_auth_update" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_auth_delete" ON {table}')

    # Recreate anon policies for all tables
    for table in ALL_TABLES:
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
