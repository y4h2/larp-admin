"""LLM base utilities for enhancement service with streaming support."""

import logging
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_config import LLMConfig
from app.services.common import LLMClient, LLMConfigManager

logger = logging.getLogger(__name__)


class LLMBase:
    """Base class for LLM operations with streaming support.

    Uses centralized LLMConfigManager and LLMClient for configuration
    and API calls.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with database session."""
        self.db = db

    async def _get_chat_config(self, config_id: str | None = None) -> LLMConfig | None:
        """Get chat LLM configuration."""
        return await LLMConfigManager.get_chat_config(self.db, config_id)

    async def _call_llm_text(
        self,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """Call LLM and return text response."""
        return await LLMClient.call_text(config, system_prompt, user_prompt)

    async def _call_llm_stream(
        self,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
    ) -> AsyncGenerator[str, None]:
        """Call LLM with streaming response."""
        async for chunk in LLMClient.call_stream(config, system_prompt, user_prompt):
            yield chunk

    async def _call_llm_json(
        self,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
    ) -> dict:
        """Call LLM and parse JSON response."""
        return await LLMClient.call_json(config, system_prompt, user_prompt)
