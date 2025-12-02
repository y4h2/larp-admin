"""
Common Service Utilities

This module provides shared utilities for LLM operations:
- LLM configuration management
- LLM client with connection pooling
- Streaming and JSON response handling

Usage:
    from app.services.common import LLMConfigManager, LLMClient

    config = await LLMConfigManager.get_chat_config(db)
    response = await LLMClient.call_text(config, system_prompt, user_prompt)
"""

from .llm_client import LLMClient
from .llm_config import LLMConfigManager

__all__ = [
    "LLMConfigManager",
    "LLMClient",
]
