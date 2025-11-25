"""Simulation API endpoints."""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.database import DBSession
from app.models.log import DialogueLog
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

    # Save dialogue log if requested
    log_id = None
    if request.save_log:
        session_id = request.session_id or str(uuid4())
        log = DialogueLog(
            session_id=session_id,
            script_id=request.script_id,
            npc_id=request.npc_id,
            player_message=request.player_message,
            npc_response=result.npc_response,
            context={
                "unlocked_clue_ids": request.unlocked_clue_ids,
                "matching_strategy": request.matching_strategy.value,
                "template_id": request.template_id,
                "llm_config_id": request.llm_config_id,
                "npc_system_template_id": request.npc_system_template_id,
                "npc_chat_config_id": request.npc_chat_config_id,
            },
            matched_clues=[mc.model_dump() for mc in result.matched_clues],
            triggered_clues=[mc.clue_id for mc in result.triggered_clues],
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        log_id = log.id
        logger.info(f"Saved dialogue log: {log_id}")

    # Add log_id to result
    result.log_id = log_id

    return result
