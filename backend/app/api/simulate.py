"""Simulation API endpoints."""

import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.database import DBSession
from app.models.npc import NPC
from app.models.script import Script
from app.schemas.simulate import SimulateRequest, SimulateResponse
from app.services.matching import MatchingService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=SimulateResponse)
async def simulate_dialogue(
    db: DBSession,
    request: SimulateRequest,
) -> SimulateResponse:
    """
    Simulate dialogue matching for testing and debugging.

    This endpoint allows designers to test how player messages would be
    matched against clues using a specified strategy.

    Args:
        db: Database session.
        request: Simulation request with context and message.

    Returns:
        SimulateResponse with matched and triggered clues.

    Raises:
        HTTPException: If script or NPC not found.
    """
    # Verify script exists
    script_result = await db.execute(
        select(Script)
        .where(Script.id == request.script_id)
        .where(Script.deleted_at.is_(None))
    )
    if not script_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script with id {request.script_id} not found",
        )

    # Verify NPC exists
    npc_result = await db.execute(
        select(NPC).where(NPC.id == request.npc_id)
    )
    if not npc_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NPC with id {request.npc_id} not found",
        )

    # Run simulation
    service = MatchingService(db)
    result = await service.simulate(request)

    logger.info(
        f"Simulation completed: {len(result.matched_clues)} matched, "
        f"{len(result.triggered_clues)} triggered"
    )

    return result
