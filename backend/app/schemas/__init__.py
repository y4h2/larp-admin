"""Pydantic schemas for request/response validation."""

from app.schemas.algorithm import (
    AlgorithmImplementationResponse,
    AlgorithmStrategyCreate,
    AlgorithmStrategyResponse,
    AlgorithmStrategyUpdate,
    GlobalConfigResponse,
    GlobalConfigUpdate,
)
from app.schemas.clue import (
    ClueCreate,
    ClueRelationCreate,
    ClueRelationResponse,
    ClueResponse,
    ClueTreeNode,
    ClueTreeResponse,
    ClueTreeValidation,
    ClueUpdate,
)
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.log import DialogueLogResponse
from app.schemas.npc import NPCCreate, NPCResponse, NPCUpdate
from app.schemas.scene import SceneCreate, SceneReorder, SceneResponse, SceneUpdate
from app.schemas.script import ScriptCreate, ScriptResponse, ScriptUpdate
from app.schemas.simulate import SimulateRequest, SimulateResponse

__all__ = [
    # Common
    "PaginationParams",
    "PaginatedResponse",
    # Script
    "ScriptCreate",
    "ScriptUpdate",
    "ScriptResponse",
    # Scene
    "SceneCreate",
    "SceneUpdate",
    "SceneResponse",
    "SceneReorder",
    # NPC
    "NPCCreate",
    "NPCUpdate",
    "NPCResponse",
    # Clue
    "ClueCreate",
    "ClueUpdate",
    "ClueResponse",
    "ClueRelationCreate",
    "ClueRelationResponse",
    "ClueTreeNode",
    "ClueTreeResponse",
    "ClueTreeValidation",
    # Algorithm
    "AlgorithmImplementationResponse",
    "AlgorithmStrategyCreate",
    "AlgorithmStrategyUpdate",
    "AlgorithmStrategyResponse",
    "GlobalConfigResponse",
    "GlobalConfigUpdate",
    # Simulate
    "SimulateRequest",
    "SimulateResponse",
    # Log
    "DialogueLogResponse",
]
