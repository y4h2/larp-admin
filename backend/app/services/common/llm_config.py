"""LLM configuration management utilities."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_config import LLMConfig, LLMConfigType

logger = logging.getLogger(__name__)


class LLMConfigManager:
    """Centralized LLM configuration management.

    Provides unified methods for retrieving LLM configurations
    across different service modules.
    """

    @staticmethod
    async def get_chat_config(
        db: AsyncSession,
        config_id: str | None = None,
    ) -> LLMConfig | None:
        """Get chat LLM configuration.

        Args:
            db: Database session
            config_id: Optional specific config ID to fetch

        Returns:
            LLMConfig if found, None otherwise

        Lookup order:
            1. Specified config_id (if provided)
            2. Default chat config (is_default=True)
            3. Any available chat config (fallback)
        """
        return await LLMConfigManager._get_config(
            db, LLMConfigType.CHAT, config_id
        )

    @staticmethod
    async def get_embedding_config(
        db: AsyncSession,
        config_id: str | None = None,
    ) -> LLMConfig | None:
        """Get embedding LLM configuration.

        Args:
            db: Database session
            config_id: Optional specific config ID to fetch

        Returns:
            LLMConfig if found, None otherwise
        """
        return await LLMConfigManager._get_config(
            db, LLMConfigType.EMBEDDING, config_id
        )

    @staticmethod
    async def _get_config(
        db: AsyncSession,
        config_type: LLMConfigType,
        config_id: str | None = None,
    ) -> LLMConfig | None:
        """Internal method to get LLM config by type.

        Args:
            db: Database session
            config_type: Type of config (CHAT or EMBEDDING)
            config_id: Optional specific config ID

        Returns:
            LLMConfig if found, None otherwise
        """
        # 1. Try specified config_id
        if config_id:
            result = await db.execute(
                select(LLMConfig).where(
                    LLMConfig.id == config_id,
                    LLMConfig.type == config_type,
                    LLMConfig.deleted_at.is_(None),
                )
            )
            config = result.scalar_one_or_none()
            if config:
                return config
            logger.warning(
                f"Specified {config_type.value} config {config_id} not found, "
                "falling back to default"
            )

        # 2. Try default config
        result = await db.execute(
            select(LLMConfig).where(
                LLMConfig.type == config_type,
                LLMConfig.is_default.is_(True),
                LLMConfig.deleted_at.is_(None),
            )
        )
        config = result.scalar_one_or_none()
        if config:
            return config

        # 3. Fallback to any available config
        result = await db.execute(
            select(LLMConfig)
            .where(
                LLMConfig.type == config_type,
                LLMConfig.deleted_at.is_(None),
            )
            .limit(1)
        )
        config = result.scalar_one_or_none()
        if not config:
            logger.warning(f"No {config_type.value} LLM config available")

        return config

    @staticmethod
    async def get_config_by_id(
        db: AsyncSession,
        config_id: str,
    ) -> LLMConfig | None:
        """Get any LLM config by ID (regardless of type).

        Args:
            db: Database session
            config_id: Config ID to fetch

        Returns:
            LLMConfig if found, None otherwise
        """
        result = await db.execute(
            select(LLMConfig).where(
                LLMConfig.id == config_id,
                LLMConfig.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()
