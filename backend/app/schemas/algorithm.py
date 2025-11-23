"""Algorithm schemas for request/response validation."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AlgorithmImplementationResponse(BaseModel):
    """Schema for AlgorithmImplementation response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    type: Literal["keyword", "embedding", "hybrid", "llm_rerank"]
    description: str | None
    doc_url: str | None
    status: Literal["available", "deprecated"]
    param_schema: dict[str, Any]


class AlgorithmStrategyBase(BaseModel):
    """Base schema for AlgorithmStrategy with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Strategy name")
    description: str | None = Field(None, description="Strategy description")
    impl_id: str = Field(..., description="Algorithm implementation ID")
    scope_type: Literal["global", "script", "scene", "npc"] = Field(
        default="global", description="Scope type"
    )
    scope_target_id: str | None = Field(
        None, description="Target ID for non-global scope"
    )
    params: dict[str, Any] = Field(
        default_factory=dict, description="Algorithm parameters"
    )


class AlgorithmStrategyCreate(AlgorithmStrategyBase):
    """Schema for creating a new AlgorithmStrategy."""

    created_by: str | None = Field(None, max_length=255, description="Creator ID")


class AlgorithmStrategyUpdate(BaseModel):
    """Schema for updating an existing AlgorithmStrategy."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    impl_id: str | None = None
    scope_type: Literal["global", "script", "scene", "npc"] | None = None
    scope_target_id: str | None = None
    params: dict[str, Any] | None = None
    updated_by: str | None = Field(None, max_length=255)


class AlgorithmStrategyResponse(AlgorithmStrategyBase):
    """Schema for AlgorithmStrategy response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    status: Literal["draft", "published", "deprecated"]
    is_default: bool
    created_by: str | None
    created_at: datetime
    updated_by: str | None
    updated_at: datetime


class GlobalConfigResponse(BaseModel):
    """Schema for global configuration response."""

    default_strategy_id: str | None = Field(
        None, description="Default strategy ID for global scope"
    )
    default_strategy: AlgorithmStrategyResponse | None = None


class GlobalConfigUpdate(BaseModel):
    """Schema for updating global configuration."""

    default_strategy_id: str = Field(..., description="New default strategy ID")
