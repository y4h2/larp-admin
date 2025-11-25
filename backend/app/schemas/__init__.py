"""Pydantic schemas for request/response validation."""

from app.schemas.clue import (
    ClueCreate,
    ClueResponse,
    ClueTreeEdge,
    ClueTreeNode,
    ClueTreeResponse,
    ClueUpdate,
)
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.debug_audit_log import (
    DebugAuditLogCreate,
    DebugAuditLogResponse,
)
from app.schemas.log import DialogueLogResponse
from app.schemas.npc import NPCCreate, NPCResponse, NPCUpdate
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
    # NPC
    "NPCCreate",
    "NPCUpdate",
    "NPCResponse",
    # Clue
    "ClueCreate",
    "ClueUpdate",
    "ClueResponse",
    "ClueTreeNode",
    "ClueTreeEdge",
    "ClueTreeResponse",
    # Simulate
    "SimulateRequest",
    "SimulateResponse",
    # Log
    "DialogueLogResponse",
    # Debug Audit Log
    "DebugAuditLogCreate",
    "DebugAuditLogResponse",
]
