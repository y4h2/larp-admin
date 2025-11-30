"""Vector-based clue matching service with multiple backend support.

Supports both Chroma (in-memory) and pgvector (PostgreSQL) backends.
"""

import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum

from langchain_openai import OpenAIEmbeddings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clue import Clue
from app.models.llm_config import LLMConfig
from app.services.template_renderer import template_renderer

logger = logging.getLogger(__name__)


class VectorBackend(str, Enum):
    """Supported vector storage backends."""

    CHROMA = "chroma"
    PGVECTOR = "pgvector"


@dataclass
class VectorMatchResult:
    """Result from vector similarity search."""

    clue_id: str
    npc_id: str
    score: float
    content: str


class BaseVectorClueRetriever(ABC):
    """Abstract base class for vector-based clue retrieval."""

    def __init__(self, embedding_config: LLMConfig) -> None:
        """
        Initialize the vector retriever with embedding configuration.

        Args:
            embedding_config: LLM config for embedding model.
        """
        self.embeddings = OpenAIEmbeddings(
            base_url=embedding_config.base_url,
            api_key=embedding_config.api_key,
            model=embedding_config.model,
        )
        self._clue_map: dict[str, Clue] = {}
        self._dimensions = (embedding_config.options or {}).get("dimensions", 1536)

    def _render_clue_content(
        self,
        clue: Clue,
        template_content: str | None,
    ) -> str:
        """
        Render clue content for embedding.

        If template is provided, renders the clue using the template.
        Otherwise, uses default: trigger_semantic_summary or detail or name.
        """
        if template_content:
            clue_context = {
                "clue": {
                    "id": clue.id,
                    "name": clue.name,
                    "type": clue.type.value if clue.type else "text",
                    "detail": clue.detail or "",
                    "detail_for_npc": clue.detail_for_npc or "",
                    "trigger_keywords": clue.trigger_keywords or [],
                    "trigger_semantic_summary": clue.trigger_semantic_summary or "",
                }
            }
            render_result = template_renderer.render(template_content, clue_context)
            if not render_result.unresolved_variables:
                return render_result.rendered_content
            else:
                logger.warning(
                    f"Template has unresolved variables: {render_result.unresolved_variables}"
                )

        # Default content
        return clue.trigger_semantic_summary or clue.detail or clue.name

    @abstractmethod
    async def build_embedding_db(
        self,
        clues: list[Clue],
        template_content: str | None = None,
    ) -> None:
        """Build the embedding database from clues."""
        pass

    @abstractmethod
    async def retrieve_clues(
        self,
        message: str,
        k: int = 5,
        score_threshold: float = 0.0,
    ) -> list[VectorMatchResult]:
        """Retrieve relevant clues for a player message."""
        pass

    def get_clue(self, clue_id: str) -> Clue | None:
        """Get clue by ID from the internal map."""
        return self._clue_map.get(clue_id)

    @abstractmethod
    async def cleanup(self) -> None:
        """Clean up resources."""
        pass


class ChromaClueRetriever(BaseVectorClueRetriever):
    """
    Chroma-based clue retrieval (in-memory).

    Uses LangChain's Chroma integration for vector storage.
    Creates a temporary collection for each session.
    """

    def __init__(self, embedding_config: LLMConfig) -> None:
        """Initialize the Chroma retriever."""
        super().__init__(embedding_config)
        self._collection_name = f"clues_{uuid.uuid4().hex[:16]}"
        self._vectorstore = None
        logger.debug(f"Created Chroma retriever with collection: {self._collection_name}")

    async def build_embedding_db(
        self,
        clues: list[Clue],
        template_content: str | None = None,
    ) -> None:
        """Build the Chroma embedding database from clues."""
        if not clues:
            return

        try:
            from langchain_chroma import Chroma
        except ImportError:
            raise ImportError(
                "langchain-chroma is required for Chroma backend. "
                "Install it with: pip install langchain-chroma"
            )

        contents: list[str] = []
        metadatas: list[dict] = []

        for clue in clues:
            rendered = self._render_clue_content(clue, template_content)
            contents.append(rendered)
            metadatas.append({
                "clue_id": clue.id,
                "npc_id": clue.npc_id,
            })
            self._clue_map[clue.id] = clue

        # Create Chroma vectorstore
        self._vectorstore = Chroma.from_texts(
            texts=contents,
            embedding=self.embeddings,
            metadatas=metadatas,
            collection_name=self._collection_name,
        )

        logger.info(f"Built Chroma embedding db with {len(clues)} clues")

    async def retrieve_clues(
        self,
        message: str,
        k: int = 5,
        score_threshold: float = 0.0,
    ) -> list[VectorMatchResult]:
        """Retrieve relevant clues using Chroma similarity search."""
        if not self._vectorstore:
            return []

        # Chroma returns (Document, score) tuples
        results = self._vectorstore.similarity_search_with_score(message, k=k)

        matched: list[VectorMatchResult] = []
        for doc, distance in results:
            # Chroma uses L2 distance, convert to similarity (0-1 range)
            # Lower distance = higher similarity
            # Use 1 / (1 + distance) as a simple conversion
            similarity = 1 / (1 + distance)

            if similarity >= score_threshold:
                matched.append(
                    VectorMatchResult(
                        clue_id=doc.metadata["clue_id"],
                        npc_id=doc.metadata["npc_id"],
                        score=similarity,
                        content=doc.page_content,
                    )
                )

        return matched

    async def cleanup(self) -> None:
        """Clean up the Chroma collection."""
        try:
            if self._vectorstore:
                # Delete the collection
                self._vectorstore.delete_collection()
                self._vectorstore = None
            self._clue_map.clear()
            logger.debug(f"Cleaned up Chroma collection: {self._collection_name}")
        except Exception as e:
            logger.warning(f"Failed to cleanup Chroma collection: {e}")


class PgVectorClueRetriever(BaseVectorClueRetriever):
    """
    pgvector-based clue retrieval (PostgreSQL).

    Uses session-scoped temporary data that is cleaned up after each request.
    """

    def __init__(self, embedding_config: LLMConfig, db: AsyncSession) -> None:
        """
        Initialize the pgvector retriever.

        Args:
            embedding_config: LLM config for embedding model.
            db: Async database session.
        """
        super().__init__(embedding_config)
        self._session_key = uuid.uuid4().hex[:32]
        self._db = db
        logger.debug(f"Created pgvector retriever with session: {self._session_key}")

    async def build_embedding_db(
        self,
        clues: list[Clue],
        template_content: str | None = None,
    ) -> None:
        """Build the pgvector embedding database from clues."""
        if not clues:
            return

        contents: list[str] = []
        for clue in clues:
            rendered = self._render_clue_content(clue, template_content)
            contents.append(rendered)
            self._clue_map[clue.id] = clue

        # Batch generate embeddings
        embeddings = await self.embeddings.aembed_documents(contents)

        # Insert into session_embeddings table
        for i, clue in enumerate(clues):
            embedding_str = "[" + ",".join(map(str, embeddings[i])) + "]"
            await self._db.execute(
                text("""
                    INSERT INTO session_embeddings
                    (session_key, clue_id, npc_id, content, embedding)
                    VALUES (:session_key, :clue_id, :npc_id, :content, CAST(:embedding AS vector))
                """),
                {
                    "session_key": self._session_key,
                    "clue_id": clue.id,
                    "npc_id": clue.npc_id,
                    "content": contents[i],
                    "embedding": embedding_str,
                },
            )

        logger.info(f"Built pgvector embedding db with {len(clues)} clues")

    async def retrieve_clues(
        self,
        message: str,
        k: int = 5,
        score_threshold: float = 0.0,
    ) -> list[VectorMatchResult]:
        """Retrieve relevant clues using pgvector similarity search."""
        # Generate query embedding
        query_embedding = await self.embeddings.aembed_query(message)
        embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"

        # pgvector: 1 - (a <=> b) = cosine similarity
        result = await self._db.execute(
            text("""
                SELECT
                    clue_id, npc_id, content,
                    1 - (embedding <=> CAST(:query AS vector)) as similarity
                FROM session_embeddings
                WHERE session_key = :session_key
                ORDER BY embedding <=> CAST(:query AS vector)
                LIMIT :k
            """),
            {
                "query": embedding_str,
                "session_key": self._session_key,
                "k": k,
            },
        )

        matched: list[VectorMatchResult] = []
        for row in result:
            if row.similarity >= score_threshold:
                matched.append(
                    VectorMatchResult(
                        clue_id=row.clue_id,
                        npc_id=row.npc_id,
                        score=row.similarity,
                        content=row.content,
                    )
                )

        return matched

    async def cleanup(self) -> None:
        """Clean up the pgvector session data."""
        try:
            await self._db.execute(
                text("DELETE FROM session_embeddings WHERE session_key = :key"),
                {"key": self._session_key},
            )
            self._clue_map.clear()
            logger.debug(f"Cleaned up pgvector session: {self._session_key}")
        except Exception as e:
            logger.warning(f"Failed to cleanup pgvector session {self._session_key}: {e}")


def create_vector_retriever(
    embedding_config: LLMConfig,
    db: AsyncSession | None = None,
    backend: VectorBackend | str | None = None,
) -> BaseVectorClueRetriever:
    """
    Factory function to create a vector retriever based on configuration.

    Args:
        embedding_config: LLM config for embedding model.
        db: Async database session (required for pgvector).
        backend: Vector backend to use. If None, uses config options or defaults to pgvector.

    Returns:
        A vector retriever instance.

    Raises:
        ValueError: If pgvector is requested but no db session is provided.
    """
    # Determine backend from config options if not specified
    if backend is None:
        options = embedding_config.options or {}
        backend = options.get("vector_backend", VectorBackend.PGVECTOR)

    # Convert string to enum if needed
    if isinstance(backend, str):
        backend = VectorBackend(backend)

    if backend == VectorBackend.CHROMA:
        logger.info("Using Chroma vector backend")
        return ChromaClueRetriever(embedding_config)
    elif backend == VectorBackend.PGVECTOR:
        if db is None:
            raise ValueError("Database session is required for pgvector backend")
        logger.info("Using pgvector vector backend")
        return PgVectorClueRetriever(embedding_config, db)
    else:
        raise ValueError(f"Unknown vector backend: {backend}")


# Backwards compatibility alias
VectorClueRetriever = PgVectorClueRetriever
