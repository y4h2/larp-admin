"""Unified LLM client with connection pooling and multiple response modes."""

import json
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import settings
from app.models.llm_config import LLMConfig

logger = logging.getLogger(__name__)


@dataclass
class LLMUsage:
    """Token usage information from LLM response."""

    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None

    @classmethod
    def from_response(cls, data: dict) -> "LLMUsage":
        """Extract usage from OpenAI-compatible API response."""
        usage = data.get("usage", {})
        return cls(
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
            total_tokens=usage.get("total_tokens"),
        )

    def to_dict(self) -> dict[str, int | None]:
        """Convert to dictionary for JSON serialization."""
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
        }


@dataclass
class LLMResponse:
    """Response from LLM with content, usage, and timing information."""

    content: str
    usage: LLMUsage = field(default_factory=LLMUsage)
    latency_ms: float | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "content": self.content,
            "usage": self.usage.to_dict(),
            "latency_ms": self.latency_ms,
        }


class LLMClient:
    """Unified LLM client with connection pooling.

    Provides methods for:
    - Text responses (call_text)
    - Streaming responses (call_stream)
    - JSON responses (call_json)
    - Structured JSON schema responses (call_structured)

    Uses connection pooling for better performance.
    """

    _client: httpx.AsyncClient | None = None
    _stream_client: httpx.AsyncClient | None = None

    @classmethod
    async def get_client(cls, timeout: float | None = None) -> httpx.AsyncClient:
        """Get or create the shared HTTP client.

        Args:
            timeout: Optional timeout override

        Returns:
            Shared AsyncClient instance
        """
        if cls._client is None:
            cls._client = httpx.AsyncClient(
                timeout=timeout or settings.llm_timeout,
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
        return cls._client

    @classmethod
    async def get_stream_client(cls) -> httpx.AsyncClient:
        """Get or create the shared streaming HTTP client.

        Returns:
            Shared AsyncClient instance for streaming
        """
        if cls._stream_client is None:
            cls._stream_client = httpx.AsyncClient(
                timeout=settings.llm_stream_timeout,
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
        return cls._stream_client

    @classmethod
    async def close(cls) -> None:
        """Close all HTTP clients. Call during application shutdown."""
        if cls._client:
            await cls._client.aclose()
            cls._client = None
        if cls._stream_client:
            await cls._stream_client.aclose()
            cls._stream_client = None

    @classmethod
    @asynccontextmanager
    async def managed_client(cls, timeout: float | None = None):
        """Context manager for temporary client usage.

        Use this when you need a client with custom timeout that
        shouldn't affect the shared client.
        """
        client = httpx.AsyncClient(
            timeout=timeout or settings.llm_timeout,
            limits=httpx.Limits(max_connections=5),
        )
        try:
            yield client
        finally:
            await client.aclose()

    @classmethod
    async def call_text(
        cls,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        timeout: float | None = None,
    ) -> str:
        """Call LLM and return text response.

        Args:
            config: LLM configuration
            system_prompt: System message
            user_prompt: User message
            temperature: Sampling temperature
            timeout: Optional timeout override

        Returns:
            Text content from LLM response
        """
        client = await cls.get_client(timeout)
        response = await client.post(
            f"{config.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {config.api_key}"},
            json={
                "model": config.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": temperature,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    @classmethod
    async def call_stream(
        cls,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """Call LLM with streaming response.

        Args:
            config: LLM configuration
            system_prompt: System message
            user_prompt: User message
            temperature: Sampling temperature

        Yields:
            Text chunks from streaming response
        """
        client = await cls.get_stream_client()
        async with client.stream(
            "POST",
            f"{config.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {config.api_key}"},
            json={
                "model": config.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": temperature,
                "stream": True,
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        content = data["choices"][0]["delta"].get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue

    @classmethod
    async def call_stream_with_messages(
        cls,
        config: LLMConfig,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[tuple[str, dict | None], None]:
        """Call LLM with streaming response using full messages array.

        Args:
            config: LLM configuration
            messages: Full messages array including history
            temperature: Sampling temperature
            max_tokens: Optional max tokens limit

        Yields:
            Tuple of (chunk, usage) where usage is None until final chunk
            Final yield is ("", usage_dict) with token counts and model info
        """
        import time
        start_time = time.time()

        client = await cls.get_stream_client()
        request_body: dict[str, Any] = {
            "model": config.model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if max_tokens is not None:
            request_body["max_tokens"] = max_tokens

        usage_info: dict | None = None

        async with client.stream(
            "POST",
            f"{config.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {config.api_key}"},
            json=request_body,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        # Check for usage in final chunk
                        if "usage" in data and data["usage"]:
                            usage_info = {
                                "prompt_tokens": data["usage"].get("prompt_tokens"),
                                "completion_tokens": data["usage"].get("completion_tokens"),
                                "total_tokens": data["usage"].get("total_tokens"),
                                "model": config.model,
                            }
                        # Yield content chunk
                        if "choices" in data and data["choices"]:
                            content = data["choices"][0].get("delta", {}).get("content", "")
                            if content:
                                yield (content, None)
                    except json.JSONDecodeError:
                        continue

        # Calculate latency and yield final usage
        latency_ms = (time.time() - start_time) * 1000
        if usage_info:
            usage_info["latency_ms"] = latency_ms
        else:
            usage_info = {"latency_ms": latency_ms, "model": config.model}

        yield ("", usage_info)

    @classmethod
    async def call_json(
        cls,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        timeout: float | None = None,
    ) -> dict:
        """Call LLM and parse JSON response.

        Args:
            config: LLM configuration
            system_prompt: System message
            user_prompt: User message
            temperature: Sampling temperature
            timeout: Optional timeout override

        Returns:
            Parsed JSON dict from LLM response

        Raises:
            ValueError: If response cannot be parsed as JSON
        """
        response_text = await cls.call_text(
            config, system_prompt, user_prompt, temperature, timeout
        )

        # Try direct JSON parse
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code blocks
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            if json_end > json_start:
                return json.loads(response_text[json_start:json_end].strip())
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            if json_end > json_start:
                return json.loads(response_text[json_start:json_end].strip())

        raise ValueError(f"Failed to parse LLM response as JSON: {response_text[:200]}")

    @classmethod
    async def call_json_mode(
        cls,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        timeout: float | None = None,
    ) -> dict:
        """Call LLM with JSON mode enabled (response_format: json_object).

        Args:
            config: LLM configuration
            system_prompt: System message
            user_prompt: User message
            temperature: Sampling temperature
            timeout: Optional timeout override

        Returns:
            Parsed JSON dict from LLM response
        """
        async with cls.managed_client(timeout or settings.llm_long_timeout) as client:
            response = await client.post(
                f"{config.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json={
                    "model": config.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": temperature,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)

    @classmethod
    async def call_structured(
        cls,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
        response_schema: dict[str, Any],
        temperature: float = 0.7,
        timeout: float | None = None,
    ) -> dict:
        """Call LLM with structured JSON schema output.

        Args:
            config: LLM configuration
            system_prompt: System message
            user_prompt: User message
            response_schema: JSON schema for structured output
            temperature: Sampling temperature
            timeout: Optional timeout override

        Returns:
            Parsed JSON dict matching the schema
        """
        client = await cls.get_client(timeout)
        response = await client.post(
            f"{config.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {config.api_key}"},
            json={
                "model": config.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": temperature,
                "response_format": response_schema,
            },
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)

    @classmethod
    async def call_with_messages(
        cls,
        config: LLMConfig,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> str:
        """Call LLM with a full messages array.

        Args:
            config: LLM configuration
            messages: Full messages array
            temperature: Sampling temperature
            max_tokens: Optional max tokens limit
            timeout: Optional timeout override

        Returns:
            Text content from LLM response
        """
        async with cls.managed_client(timeout or settings.llm_long_timeout) as client:
            request_body: dict[str, Any] = {
                "model": config.model,
                "messages": messages,
                "temperature": temperature,
            }
            if max_tokens is not None:
                request_body["max_tokens"] = max_tokens

            response = await client.post(
                f"{config.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json=request_body,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    # ========== Methods with usage/latency tracking ==========

    @classmethod
    async def call_structured_with_usage(
        cls,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
        response_schema: dict[str, Any],
        temperature: float = 0.7,
        timeout: float | None = None,
    ) -> LLMResponse:
        """Call LLM with structured JSON schema output and return usage metrics.

        Args:
            config: LLM configuration
            system_prompt: System message
            user_prompt: User message
            response_schema: JSON schema for structured output
            temperature: Sampling temperature
            timeout: Optional timeout override

        Returns:
            LLMResponse with parsed JSON content, usage stats, and latency
        """
        client = await cls.get_client(timeout)
        start_time = time.time()

        response = await client.post(
            f"{config.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {config.api_key}"},
            json={
                "model": config.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": temperature,
                "response_format": response_schema,
            },
        )
        latency_ms = (time.time() - start_time) * 1000

        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        usage = LLMUsage.from_response(data)

        return LLMResponse(
            content=content,
            usage=usage,
            latency_ms=latency_ms,
        )

    @classmethod
    async def call_with_messages_with_usage(
        cls,
        config: LLMConfig,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> LLMResponse:
        """Call LLM with a full messages array and return usage metrics.

        Args:
            config: LLM configuration
            messages: Full messages array
            temperature: Sampling temperature
            max_tokens: Optional max tokens limit
            timeout: Optional timeout override

        Returns:
            LLMResponse with text content, usage stats, and latency
        """
        async with cls.managed_client(timeout or settings.llm_long_timeout) as client:
            request_body: dict[str, Any] = {
                "model": config.model,
                "messages": messages,
                "temperature": temperature,
            }
            if max_tokens is not None:
                request_body["max_tokens"] = max_tokens

            start_time = time.time()
            response = await client.post(
                f"{config.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json=request_body,
            )
            latency_ms = (time.time() - start_time) * 1000

            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            usage = LLMUsage.from_response(data)

            return LLMResponse(
                content=content,
                usage=usage,
                latency_ms=latency_ms,
            )
