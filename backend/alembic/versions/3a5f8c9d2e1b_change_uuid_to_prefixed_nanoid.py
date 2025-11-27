"""Change UUID columns to prefixed NanoID (VARCHAR(20)).

Revision ID: 3a5f8c9d2e1b
Revises: 2356bde222ec
Create Date: 2024-11-26 22:45:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "3a5f8c9d2e1b"
down_revision: str | None = "2356bde222ec"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade: Change UUID columns to VARCHAR(20) for prefixed NanoID."""

    # Clear existing data first (development only)
    op.execute("TRUNCATE TABLE dialogue_logs CASCADE")
    op.execute("TRUNCATE TABLE clues CASCADE")
    op.execute("TRUNCATE TABLE npcs CASCADE")
    op.execute("TRUNCATE TABLE scripts CASCADE")
    op.execute("TRUNCATE TABLE prompt_templates CASCADE")
    op.execute("TRUNCATE TABLE llm_configs CASCADE")

    # Drop foreign key constraints first
    op.drop_constraint("dialogue_logs_npc_id_fkey", "dialogue_logs", type_="foreignkey")
    op.drop_constraint("dialogue_logs_script_id_fkey", "dialogue_logs", type_="foreignkey")
    op.drop_constraint("clues_npc_id_fkey", "clues", type_="foreignkey")
    op.drop_constraint("clues_script_id_fkey", "clues", type_="foreignkey")
    op.drop_constraint("npcs_script_id_fkey", "npcs", type_="foreignkey")

    # Scripts table
    op.alter_column(
        "scripts",
        "id",
        existing_type=postgresql.UUID(),
        type_=sa.String(length=20),
        existing_nullable=False,
    )

    # NPCs table
    op.alter_column(
        "npcs",
        "id",
        existing_type=postgresql.UUID(),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
    op.alter_column(
        "npcs",
        "script_id",
        existing_type=postgresql.UUID(),
        type_=sa.String(length=20),
        existing_nullable=False,
    )

    # Clues table
    op.alter_column(
        "clues",
        "id",
        existing_type=postgresql.UUID(),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
    op.alter_column(
        "clues",
        "script_id",
        existing_type=postgresql.UUID(),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
    op.alter_column(
        "clues",
        "npc_id",
        existing_type=postgresql.UUID(),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
    # Change prereq_clue_ids array type
    op.execute("ALTER TABLE clues ALTER COLUMN prereq_clue_ids TYPE VARCHAR(20)[] USING prereq_clue_ids::VARCHAR(20)[]")

    # Dialogue logs table
    op.alter_column(
        "dialogue_logs",
        "id",
        existing_type=postgresql.UUID(),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
    op.alter_column(
        "dialogue_logs",
        "script_id",
        existing_type=postgresql.UUID(),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
    op.alter_column(
        "dialogue_logs",
        "npc_id",
        existing_type=postgresql.UUID(),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
    # Change triggered_clues array type
    op.execute("ALTER TABLE dialogue_logs ALTER COLUMN triggered_clues TYPE VARCHAR(20)[] USING triggered_clues::VARCHAR(20)[]")

    # Prompt templates table
    op.alter_column(
        "prompt_templates",
        "id",
        existing_type=postgresql.UUID(),
        type_=sa.String(length=20),
        existing_nullable=False,
    )

    # LLM configs table
    op.alter_column(
        "llm_configs",
        "id",
        existing_type=postgresql.UUID(),
        type_=sa.String(length=20),
        existing_nullable=False,
    )

    # Recreate foreign key constraints
    op.create_foreign_key(
        "npcs_script_id_fkey",
        "npcs",
        "scripts",
        ["script_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "clues_script_id_fkey",
        "clues",
        "scripts",
        ["script_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "clues_npc_id_fkey",
        "clues",
        "npcs",
        ["npc_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "dialogue_logs_script_id_fkey",
        "dialogue_logs",
        "scripts",
        ["script_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "dialogue_logs_npc_id_fkey",
        "dialogue_logs",
        "npcs",
        ["npc_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Downgrade: Revert VARCHAR(20) columns back to UUID."""

    # Clear existing data first
    op.execute("TRUNCATE TABLE dialogue_logs CASCADE")
    op.execute("TRUNCATE TABLE clues CASCADE")
    op.execute("TRUNCATE TABLE npcs CASCADE")
    op.execute("TRUNCATE TABLE scripts CASCADE")
    op.execute("TRUNCATE TABLE prompt_templates CASCADE")
    op.execute("TRUNCATE TABLE llm_configs CASCADE")

    # Drop foreign key constraints first
    op.drop_constraint("dialogue_logs_npc_id_fkey", "dialogue_logs", type_="foreignkey")
    op.drop_constraint("dialogue_logs_script_id_fkey", "dialogue_logs", type_="foreignkey")
    op.drop_constraint("clues_npc_id_fkey", "clues", type_="foreignkey")
    op.drop_constraint("clues_script_id_fkey", "clues", type_="foreignkey")
    op.drop_constraint("npcs_script_id_fkey", "npcs", type_="foreignkey")

    # LLM configs table
    op.alter_column(
        "llm_configs",
        "id",
        existing_type=sa.String(length=20),
        type_=postgresql.UUID(),
        existing_nullable=False,
        postgresql_using="gen_random_uuid()",
    )

    # Prompt templates table
    op.alter_column(
        "prompt_templates",
        "id",
        existing_type=sa.String(length=20),
        type_=postgresql.UUID(),
        existing_nullable=False,
        postgresql_using="gen_random_uuid()",
    )

    # Dialogue logs table - change array type first
    op.execute("ALTER TABLE dialogue_logs ALTER COLUMN triggered_clues TYPE UUID[] USING '{}'::UUID[]")
    op.alter_column(
        "dialogue_logs",
        "npc_id",
        existing_type=sa.String(length=20),
        type_=postgresql.UUID(),
        existing_nullable=False,
        postgresql_using="gen_random_uuid()",
    )
    op.alter_column(
        "dialogue_logs",
        "script_id",
        existing_type=sa.String(length=20),
        type_=postgresql.UUID(),
        existing_nullable=False,
        postgresql_using="gen_random_uuid()",
    )
    op.alter_column(
        "dialogue_logs",
        "id",
        existing_type=sa.String(length=20),
        type_=postgresql.UUID(),
        existing_nullable=False,
        postgresql_using="gen_random_uuid()",
    )

    # Clues table - change array type first
    op.execute("ALTER TABLE clues ALTER COLUMN prereq_clue_ids TYPE UUID[] USING '{}'::UUID[]")
    op.alter_column(
        "clues",
        "npc_id",
        existing_type=sa.String(length=20),
        type_=postgresql.UUID(),
        existing_nullable=False,
        postgresql_using="gen_random_uuid()",
    )
    op.alter_column(
        "clues",
        "script_id",
        existing_type=sa.String(length=20),
        type_=postgresql.UUID(),
        existing_nullable=False,
        postgresql_using="gen_random_uuid()",
    )
    op.alter_column(
        "clues",
        "id",
        existing_type=sa.String(length=20),
        type_=postgresql.UUID(),
        existing_nullable=False,
        postgresql_using="gen_random_uuid()",
    )

    # NPCs table
    op.alter_column(
        "npcs",
        "script_id",
        existing_type=sa.String(length=20),
        type_=postgresql.UUID(),
        existing_nullable=False,
        postgresql_using="gen_random_uuid()",
    )
    op.alter_column(
        "npcs",
        "id",
        existing_type=sa.String(length=20),
        type_=postgresql.UUID(),
        existing_nullable=False,
        postgresql_using="gen_random_uuid()",
    )

    # Scripts table
    op.alter_column(
        "scripts",
        "id",
        existing_type=sa.String(length=20),
        type_=postgresql.UUID(),
        existing_nullable=False,
        postgresql_using="gen_random_uuid()",
    )

    # Recreate foreign key constraints
    op.create_foreign_key(
        "npcs_script_id_fkey",
        "npcs",
        "scripts",
        ["script_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "clues_script_id_fkey",
        "clues",
        "scripts",
        ["script_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "clues_npc_id_fkey",
        "clues",
        "npcs",
        ["npc_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "dialogue_logs_script_id_fkey",
        "dialogue_logs",
        "scripts",
        ["script_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "dialogue_logs_npc_id_fkey",
        "dialogue_logs",
        "npcs",
        ["npc_id"],
        ["id"],
        ondelete="CASCADE",
    )
