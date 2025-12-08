"""LLMConfig schemas for API endpoints."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


def mask_api_key(api_key: str) -> str:
    """Mask API key for display."""
    if not api_key or len(api_key) < 8:
        return "***"
    return f"{api_key[:4]}...{api_key[-4:]}"


class LLMConfigResponse(BaseModel):
    """Schema for LLMConfig response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: str
    model: str
    base_url: str
    api_key_masked: str
    is_default: bool
    options: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    @classmethod
    def from_model(cls, model: Any) -> "LLMConfigResponse":
        """Create response from model with masked API key."""
        return cls(
            id=model.id,
            name=model.name,
            type=model.type.value if hasattr(model.type, "value") else model.type,
            model=model.model,
            base_url=model.base_url,
            api_key_masked=mask_api_key(model.api_key),
            is_default=model.is_default,
            options=model.options or {},
            created_at=model.created_at,
            updated_at=model.updated_at,
            deleted_at=model.deleted_at,
        )


class LLMConfigCreate(BaseModel):
    """Schema for creating an LLM config."""

    name: str = Field(..., min_length=1, max_length=255)
    type: Literal["embedding", "chat"]
    model: str = Field(..., min_length=1, max_length=255)
    base_url: str = Field(..., min_length=1, max_length=512)
    api_key: str = Field(..., min_length=1)
    is_default: bool = False
    options: dict[str, Any] = Field(default_factory=dict)


class LLMConfigUpdate(BaseModel):
    """Schema for updating an LLM config."""

    name: str | None = Field(None, min_length=1, max_length=255)
    model: str | None = Field(None, min_length=1, max_length=255)
    base_url: str | None = Field(None, min_length=1, max_length=512)
    api_key: str | None = Field(None, min_length=1)
    is_default: bool | None = None
    options: dict[str, Any] | None = None


class LLMConfigExportData(BaseModel):
    """Schema for a single LLM config in export/import format."""

    name: str
    type: Literal["embedding", "chat"]
    model: str
    base_url: str
    api_key: str = ""
    is_default: bool = False
    options: dict[str, Any] = Field(default_factory=dict)


class LLMConfigsExportBundle(BaseModel):
    """Schema for LLM configs export bundle."""

    version: str = "1.0"
    exported_at: str | None = None
    configs: list[LLMConfigExportData]


class LLMConfigImportRequest(BaseModel):
    """Schema for importing LLM configs."""

    data: LLMConfigsExportBundle
    skip_existing: bool = Field(
        default=True,
        description="Skip configs with same name instead of raising error",
    )
