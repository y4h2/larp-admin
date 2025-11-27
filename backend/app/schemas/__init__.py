"""Pydantic schemas for request/response validation.

Note: CRUD schemas for scripts, npcs, clues removed - now handled via Supabase PostgREST.
Only complex operation schemas (export/import, clue-tree) and API-specific schemas are kept.
"""

from app.schemas.clue import (
    ClueTreeEdge,
    ClueTreeNode,
    ClueTreeResponse,
)
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.debug_audit_log import (
    DebugAuditLogCreate,
    DebugAuditLogResponse,
)
from app.schemas.log import DialogueLogResponse
from app.schemas.script import ScriptResponse
from app.schemas.simulate import SimulateRequest, SimulateResponse

__all__ = [
    # Common
    "PaginationParams",
    "PaginatedResponse",
    # Script
    "ScriptResponse",
    # Clue Tree
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
