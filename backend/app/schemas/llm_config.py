"""LLM Configuration schemas for request/response validation."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class EmbeddingOptions(BaseModel):
    """Options specific to embedding models."""

    similarity_threshold: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Minimum similarity score for semantic matching (0.0 - 1.0)",
    )
    dimensions: int | None = Field(
        default=None,
        ge=1,
        description="Embedding dimensions (optional, for models that support it)",
    )


class ChatOptions(BaseModel):
    """Options specific to chat models."""

    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Sampling temperature (0.0 - 2.0)",
    )
    max_tokens: int | None = Field(
        default=None,
        ge=1,
        description="Maximum tokens to generate",
    )
    top_p: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Nucleus sampling parameter (0.0 - 1.0)",
    )
    frequency_penalty: float = Field(
        default=0.0,
        ge=-2.0,
        le=2.0,
        description="Frequency penalty (-2.0 - 2.0)",
    )
    presence_penalty: float = Field(
        default=0.0,
        ge=-2.0,
        le=2.0,
        description="Presence penalty (-2.0 - 2.0)",
    )


class LLMConfigBase(BaseModel):
    """Base schema for LLM Configuration."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Display name for this configuration",
    )
    type: Literal["embedding", "chat"] = Field(
        ...,
        description="Configuration type: embedding or chat",
    )
    model: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Model name (e.g., text-embedding-ada-002, gpt-4)",
    )
    base_url: str = Field(
        ...,
        min_length=1,
        max_length=512,
        description="API base URL",
    )
    api_key: str = Field(
        ...,
        min_length=1,
        description="API key",
    )
    is_default: bool = Field(
        default=False,
        description="Whether this is the default config for its type",
    )
    options: dict[str, Any] = Field(
        default_factory=dict,
        description="Type-specific options",
    )


class LLMConfigCreate(LLMConfigBase):
    """Schema for creating a new LLM Configuration."""

    pass


class LLMConfigUpdate(BaseModel):
    """Schema for updating an existing LLM Configuration."""

    name: str | None = Field(None, min_length=1, max_length=255)
    model: str | None = Field(None, min_length=1, max_length=255)
    base_url: str | None = Field(None, min_length=1, max_length=512)
    api_key: str | None = Field(None, min_length=1)
    is_default: bool | None = None
    options: dict[str, Any] | None = None


def mask_api_key(api_key: str) -> str:
    """Mask API key, showing only first 4 and last 4 characters."""
    if not api_key or len(api_key) <= 8:
        return "****"
    return f"{api_key[:4]}{'*' * (len(api_key) - 8)}{api_key[-4:]}"


class LLMConfigResponse(BaseModel):
    """Schema for LLM Configuration response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: Literal["embedding", "chat"]
    model: str
    base_url: str
    api_key_masked: str = Field(description="Masked API key")
    is_default: bool
    options: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    @classmethod
    def from_model(cls, obj: Any) -> "LLMConfigResponse":
        """Create response from model with masked API key."""
        return cls(
            id=obj.id,
            name=obj.name,
            type=obj.type.value if hasattr(obj.type, "value") else obj.type,
            model=obj.model,
            base_url=obj.base_url,
            api_key_masked=mask_api_key(obj.api_key),
            is_default=obj.is_default,
            options=obj.options,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
            deleted_at=obj.deleted_at,
        )


class LLMConfigListResponse(LLMConfigResponse):
    """Schema for LLM Configuration in list response."""

    pass
