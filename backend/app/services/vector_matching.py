"""Vector-based clue matching service using LangChain and Chroma.

Based on VectorClueRetrievalStrategy from data/sample/clue.py.
"""

import logging
import uuid
from dataclasses import dataclass

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings

from app.models.clue import Clue
from app.models.llm_config import LLMConfig
from app.services.template_renderer import template_renderer

logger = logging.getLogger(__name__)


@dataclass
class VectorMatchResult:
    """Result from vector similarity search."""

    clue_id: str
    npc_id: str
    score: float
    content: str


class VectorClueRetriever:
    """
    Vector-based clue retrieval using LangChain and Chroma.

    Based on VectorClueRetrievalStrategy from data/sample/clue.py.
    Uses OpenAIEmbeddings and Chroma vector store for similarity search.

    Each instance uses a unique collection name to avoid conflicts between
    concurrent requests. The collection is cleaned up after use.
    """

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
        # Use unique collection name per instance to avoid conflicts
        self._collection_name = f"clue_collection_{uuid.uuid4().hex[:8]}"
        self.vector_store = Chroma(
            collection_name=self._collection_name,
            embedding_function=self.embeddings,
        )
        self._clue_map: dict[str, Clue] = {}
        logger.debug(f"Created vector store with collection: {self._collection_name}")

    def build_embedding_db(
        self,
        clues: list[Clue],
        template_content: str | None = None,
    ) -> None:
        """
        Build the embedding database from clues.

        Args:
            clues: List of clues to index.
            template_content: Optional template for rendering clue content.
                Example: '{clue.name}:{clue.detail}'
        """
        documents: list[Document] = []

        for clue in clues:
            # Render clue content using template
            rendered_content = self._render_clue_content(clue, template_content)

            doc = Document(
                page_content=rendered_content,
                metadata={
                    "clue_id": clue.id,
                    "npc_id": clue.npc_id,
                },
                id=clue.id,
            )
            documents.append(doc)
            self._clue_map[clue.id] = clue

        if documents:
            self.vector_store.add_documents(documents=documents)
            logger.info(f"Built embedding database with {len(documents)} clues")

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

    def retrieve_clues(
        self,
        message: str,
        k: int = 5,
        score_threshold: float = 0.0,
    ) -> list[VectorMatchResult]:
        """
        Retrieve relevant clues for a player message.

        Args:
            message: Player's message to match against clues.
            k: Maximum number of results to return.
            score_threshold: Minimum similarity score (0.0-1.0).

        Returns:
            List of VectorMatchResult with matched clues and scores.
        """
        # Use similarity_search_with_relevance_scores for scoring
        results = self.vector_store.similarity_search_with_relevance_scores(
            message,
            k=k,
        )

        matched: list[VectorMatchResult] = []
        for doc, score in results:
            if score >= score_threshold:
                matched.append(
                    VectorMatchResult(
                        clue_id=doc.metadata["clue_id"],
                        npc_id=doc.metadata["npc_id"],
                        score=score,
                        content=doc.page_content,
                    )
                )

        return matched

    def get_clue(self, clue_id: str) -> Clue | None:
        """Get clue by ID from the internal map."""
        return self._clue_map.get(clue_id)

    def cleanup(self) -> None:
        """
        Clean up the vector store collection.

        Should be called after use to free resources and avoid
        accumulating stale collections.
        """
        try:
            self.vector_store.delete_collection()
            self._clue_map.clear()
            logger.debug(f"Cleaned up collection: {self._collection_name}")
        except Exception as e:
            logger.warning(f"Failed to cleanup collection {self._collection_name}: {e}")
