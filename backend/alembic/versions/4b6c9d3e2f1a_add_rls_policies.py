"""Add RLS policies for PostgREST access.

Revision ID: 4b6c9d3e2f1a
Revises: 3a5f8c9d2e1b
Create Date: 2024-11-27

This migration:
1. Enables RLS on tables accessed via PostgREST
2. Adds policies for anon role to access data
3. Adds soft delete filtering at database level
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4b6c9d3e2f1a"
down_revision: str | None = "3a5f8c9d2e1b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Enable RLS and add policies for PostgREST access."""

    # Enable RLS on tables that will be accessed via PostgREST
    tables = ["llm_configs", "prompt_templates", "scripts", "npcs", "clues", "dialogue_logs"]

    for table in tables:
        # Enable RLS
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

        # Allow anon role full access (for development)
        # In production, you'd want more restrictive policies
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

    # Create a view that automatically filters soft-deleted records
    # This is optional - the frontend already filters, but this provides
    # an additional layer of safety

    # For llm_configs
    op.execute("""
        CREATE OR REPLACE VIEW llm_configs_active AS
        SELECT * FROM llm_configs WHERE deleted_at IS NULL
    """)

    # For prompt_templates
    op.execute("""
        CREATE OR REPLACE VIEW prompt_templates_active AS
        SELECT * FROM prompt_templates WHERE deleted_at IS NULL
    """)

    # For scripts
    op.execute("""
        CREATE OR REPLACE VIEW scripts_active AS
        SELECT * FROM scripts WHERE deleted_at IS NULL
    """)


def downgrade() -> None:
    """Remove RLS policies and disable RLS."""

    # Drop views
    op.execute("DROP VIEW IF EXISTS llm_configs_active")
    op.execute("DROP VIEW IF EXISTS prompt_templates_active")
    op.execute("DROP VIEW IF EXISTS scripts_active")

    tables = ["llm_configs", "prompt_templates", "scripts", "npcs", "clues", "dialogue_logs"]

    for table in tables:
        # Drop policies
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_select" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_insert" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_update" ON {table}')
        op.execute(f'DROP POLICY IF EXISTS "{table}_anon_delete" ON {table}')

        # Disable RLS
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
