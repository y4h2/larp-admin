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

    # With usage tracking:
    llm_response = await LLMClient.call_with_messages_with_usage(config, messages)
    print(f"Tokens: {llm_response.usage.total_tokens}, Latency: {llm_response.latency_ms}ms")
"""

from .llm_client import LLMClient, LLMResponse, LLMUsage
from .llm_config import LLMConfigManager

__all__ = [
    "LLMConfigManager",
    "LLMClient",
    "LLMResponse",
    "LLMUsage",
]
