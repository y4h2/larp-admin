"""Initial migration - create all tables

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create scripts table
    op.create_table(
        "scripts",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "status",
            sa.Enum("draft", "test", "online", name="script_status", create_type=True),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("player_count", sa.Integer, nullable=False, server_default="1"),
        sa.Column("expected_duration", sa.Integer, nullable=True),
        sa.Column(
            "difficulty",
            sa.Enum("easy", "medium", "hard", name="script_difficulty", create_type=True),
            nullable=False,
            server_default="medium",
        ),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True, index=True),
    )

    # Create scenes table
    op.create_table(
        "scenes",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "script_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("scripts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "scene_type",
            sa.Enum(
                "investigation", "interrogation", "free_dialogue", name="scene_type", create_type=True
            ),
            nullable=False,
            server_default="investigation",
        ),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create npcs table
    op.create_table(
        "npcs",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "script_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("scripts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("name_en", sa.String(255), nullable=True),
        sa.Column("age", sa.Integer, nullable=True),
        sa.Column("job", sa.String(255), nullable=True),
        sa.Column(
            "role_type",
            sa.Enum("suspect", "witness", "other", name="npc_role_type", create_type=True),
            nullable=False,
            server_default="other",
        ),
        sa.Column("personality", sa.Text, nullable=True),
        sa.Column("speech_style", sa.Text, nullable=True),
        sa.Column("background_story", sa.Text, nullable=True),
        sa.Column("relations", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("system_prompt_template", sa.Text, nullable=True),
        sa.Column(
            "extra_prompt_vars", postgresql.JSONB, nullable=False, server_default="{}"
        ),
        sa.Column(
            "status",
            sa.Enum("active", "archived", name="npc_status", create_type=True),
            nullable=False,
            server_default="active",
        ),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create clues table
    op.create_table(
        "clues",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "script_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("scripts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "scene_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("scenes.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("title_internal", sa.String(255), nullable=False),
        sa.Column("title_player", sa.String(255), nullable=False),
        sa.Column("content_text", sa.Text, nullable=False),
        sa.Column(
            "content_type",
            sa.Enum("text", "image", "structured", name="content_type", create_type=True),
            nullable=False,
            server_default="text",
        ),
        sa.Column(
            "content_payload", postgresql.JSONB, nullable=False, server_default="{}"
        ),
        sa.Column(
            "clue_type",
            sa.Enum("evidence", "testimony", "world_info", "decoy", name="clue_type", create_type=True),
            nullable=False,
            server_default="evidence",
        ),
        sa.Column(
            "importance",
            sa.Enum("critical", "major", "minor", "easter_egg", name="clue_importance", create_type=True),
            nullable=False,
            server_default="minor",
        ),
        sa.Column("stage", sa.Integer, nullable=False, server_default="1"),
        sa.Column(
            "npc_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=False)),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "status",
            sa.Enum("draft", "active", "disabled", name="clue_status", create_type=True),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "unlock_conditions", postgresql.JSONB, nullable=False, server_default="{}"
        ),
        sa.Column("effects", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("one_time", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
    )

    # Create clue_relations table
    op.create_table(
        "clue_relations",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "prerequisite_clue_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("clues.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "dependent_clue_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("clues.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "relation_type",
            sa.Enum("required", "optional", name="clue_relation_type", create_type=True),
            nullable=False,
            server_default="required",
        ),
    )

    # Create algorithm_implementations table
    op.create_table(
        "algorithm_implementations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "type",
            sa.Enum("keyword", "embedding", "hybrid", "llm_rerank", name="algorithm_type", create_type=True),
            nullable=False,
        ),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("doc_url", sa.String(512), nullable=True),
        sa.Column(
            "status",
            sa.Enum("available", "deprecated", name="algorithm_impl_status", create_type=True),
            nullable=False,
            server_default="available",
        ),
        sa.Column(
            "param_schema", postgresql.JSONB, nullable=False, server_default="{}"
        ),
    )

    # Create algorithm_strategies table
    op.create_table(
        "algorithm_strategies",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "impl_id",
            sa.String(64),
            sa.ForeignKey("algorithm_implementations.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "scope_type",
            sa.Enum("global", "script", "scene", "npc", name="strategy_scope_type", create_type=True),
            nullable=False,
            server_default="global",
        ),
        sa.Column("scope_target_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("params", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "status",
            sa.Enum("draft", "published", "deprecated", name="strategy_status", create_type=True),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create dialogue_logs table
    op.create_table(
        "dialogue_logs",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "script_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("scripts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "scene_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("scenes.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "npc_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("npcs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("player_message", sa.Text, nullable=False),
        sa.Column("context", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "strategy_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("algorithm_strategies.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "matched_clues", postgresql.JSONB, nullable=False, server_default="{}"
        ),
        sa.Column(
            "triggered_clues",
            postgresql.ARRAY(postgresql.UUID(as_uuid=False)),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            index=True,
        ),
    )

    # Insert default algorithm implementations
    op.execute("""
        INSERT INTO algorithm_implementations (id, type, description, status, param_schema)
        VALUES
        ('keyword_v1', 'keyword', 'Basic keyword matching algorithm', 'available', '{
            "type": "object",
            "properties": {
                "trigger_threshold": {"type": "number", "minimum": 0, "maximum": 1, "default": 0.5},
                "case_sensitive": {"type": "boolean", "default": false}
            }
        }'),
        ('embedding_v1', 'embedding', 'Embedding-based semantic matching', 'available', '{
            "type": "object",
            "properties": {
                "similarity_threshold": {"type": "number", "minimum": 0, "maximum": 1, "default": 0.7},
                "model": {"type": "string", "default": "text-embedding-ada-002"}
            }
        }'),
        ('hybrid_v1', 'hybrid', 'Combined keyword and embedding matching', 'available', '{
            "type": "object",
            "properties": {
                "keyword_weight": {"type": "number", "minimum": 0, "maximum": 1, "default": 0.5},
                "embedding_weight": {"type": "number", "minimum": 0, "maximum": 1, "default": 0.5},
                "trigger_threshold": {"type": "number", "minimum": 0, "maximum": 1, "default": 0.5}
            }
        }')
    """)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("dialogue_logs")
    op.drop_table("algorithm_strategies")
    op.drop_table("algorithm_implementations")
    op.drop_table("clue_relations")
    op.drop_table("clues")
    op.drop_table("npcs")
    op.drop_table("scenes")
    op.drop_table("scripts")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS strategy_status")
    op.execute("DROP TYPE IF EXISTS strategy_scope_type")
    op.execute("DROP TYPE IF EXISTS algorithm_impl_status")
    op.execute("DROP TYPE IF EXISTS algorithm_type")
    op.execute("DROP TYPE IF EXISTS clue_relation_type")
    op.execute("DROP TYPE IF EXISTS clue_status")
    op.execute("DROP TYPE IF EXISTS clue_importance")
    op.execute("DROP TYPE IF EXISTS clue_type")
    op.execute("DROP TYPE IF EXISTS content_type")
    op.execute("DROP TYPE IF EXISTS npc_status")
    op.execute("DROP TYPE IF EXISTS npc_role_type")
    op.execute("DROP TYPE IF EXISTS scene_type")
    op.execute("DROP TYPE IF EXISTS script_difficulty")
    op.execute("DROP TYPE IF EXISTS script_status")
