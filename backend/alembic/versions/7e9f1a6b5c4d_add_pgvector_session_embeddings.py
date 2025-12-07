"""Add pgvector extension and session_embeddings table

Revision ID: 7e9f1a6b5c4d
Revises: 3a5f8c9d2e1b
Create Date: 2024-11-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '7e9f1a6b5c4d'
down_revision: Union[str, None] = '3a5f8c9d2e1b'
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
            embedding vector(1536),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)

    # Create index for faster lookups by session_key
    op.execute("""
        CREATE INDEX idx_session_embeddings_session_key
        ON session_embeddings(session_key);
    """)

    # Create vector similarity index using HNSW (faster for approximate nearest neighbor)
    op.execute("""
        CREATE INDEX idx_session_embeddings_vector
        ON session_embeddings
        USING hnsw (embedding vector_cosine_ops);
    """)


def downgrade() -> None:
    """Remove session_embeddings table and pgvector extension."""
    op.execute("DROP TABLE IF EXISTS session_embeddings;")
    op.execute("DROP EXTENSION IF EXISTS vector;")
