"""Add pgvector extension and session_embeddings table

Revision ID: 7e9f1a6b5c4d
Revises: 6d8e0f5a4b3c
Create Date: 2024-11-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '7e9f1a6b5c4d'
down_revision: Union[str, None] = '6d8e0f5a4b3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable pgvector extension and create session_embeddings table."""
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # Create session_embeddings table (UNLOGGED for better performance)
    # This table stores temporary embeddings for each simulation request
    op.execute("""
        CREATE UNLOGGED TABLE session_embeddings (
            id SERIAL PRIMARY KEY,
            session_key VARCHAR(32) NOT NULL,
            clue_id VARCHAR(20) NOT NULL,
            npc_id VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            embedding vector,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    # Index for fast cleanup by session
    op.execute("""
        CREATE INDEX idx_session_embeddings_session
            ON session_embeddings(session_key)
    """)

    # Index for cleanup of stale sessions
    op.execute("""
        CREATE INDEX idx_session_embeddings_created_at
            ON session_embeddings(created_at)
    """)


def downgrade() -> None:
    """Drop session_embeddings table and pgvector extension."""
    op.execute("DROP TABLE IF EXISTS session_embeddings;")
    op.execute("DROP EXTENSION IF EXISTS vector;")
