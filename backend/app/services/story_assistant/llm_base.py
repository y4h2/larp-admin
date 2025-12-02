"""Base class for LLM-powered generators."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_config import LLMConfig
from app.services.common import LLMClient, LLMConfigManager

logger = logging.getLogger(__name__)


class LLMBase:
    """Base class providing LLM configuration and calling utilities.

    Uses centralized LLMConfigManager and LLMClient for configuration
    and API calls.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with database session."""
        self.db = db

    async def _get_chat_config(self, config_id: str | None = None) -> LLMConfig | None:
        """Get chat LLM configuration."""
        return await LLMConfigManager.get_chat_config(self.db, config_id)

    async def _call_llm_json(
        self,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
    ) -> dict:
        """Call LLM and parse JSON response using JSON mode."""
        return await LLMClient.call_json_mode(
            config, system_prompt, user_prompt, temperature
        )
