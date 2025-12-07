"""Simulation API endpoints."""

import json
import logging
from collections.abc import AsyncGenerator
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.database import DBSession
from app.dependencies.auth import get_current_active_user
from app.models.log import DialogueLog
from app.models.npc import NPC
from app.models.script import Script
from app.schemas.simulate import SimulateRequest, SimulateResponse
from app.services.matching import MatchingService

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_active_user)])


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
    try:
        result = await service.simulate(request)
    except httpx.TimeoutException as e:
        logger.error(f"LLM request timeout: {e}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="LLM 响应超时，请稍后重试或检查 LLM 服务状态",
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"LLM HTTP error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM 服务返回错误: {e.response.status_code}",
        )
    except Exception as e:
        logger.error(f"Simulation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"模拟对话失败: {str(e)}",
        )

    logger.info(
        f"Simulation completed: {len(result.matched_clues)} matched, "
        f"{len(result.triggered_clues)} triggered"
    )

    # Save dialogue log if requested
    log_id = None
    if request.save_log:
        session_id = request.session_id or str(uuid4())
        # Merge llm_usage into debug_info for persistence
        debug_info_to_save = result.debug_info.copy() if result.debug_info else {}
        if result.llm_usage:
            debug_info_to_save["llm_usage"] = result.llm_usage.model_dump()
        log = DialogueLog(
            session_id=session_id,
            username=request.username,
            script_id=request.script_id,
            npc_id=request.npc_id,
            player_message=request.player_message,
            npc_response=result.npc_response,
            context={
                "unlocked_clue_ids": request.unlocked_clue_ids,
                "matching_strategy": request.matching_strategy.value,
                "template_id": request.template_id,
                "llm_config_id": request.llm_config_id,
                "npc_clue_template_id": request.npc_clue_template_id,
                "npc_no_clue_template_id": request.npc_no_clue_template_id,
                "npc_chat_config_id": request.npc_chat_config_id,
            },
            matched_clues=[mc.model_dump() for mc in result.matched_clues],
            triggered_clues=[mc.clue_id for mc in result.triggered_clues],
            debug_info=debug_info_to_save,
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        log_id = log.id
        logger.info(f"Saved dialogue log: {log_id}")

    # Add log_id to result
    result.log_id = log_id

    return result


@router.post("/stream")
async def simulate_dialogue_stream(
    db: DBSession,
    request: SimulateRequest,
) -> StreamingResponse:
    """
    Simulate dialogue matching with streaming NPC response.

    Returns Server-Sent Events:
    - event: match_result - Clue matching results
    - event: npc_chunk - NPC response token
    - event: complete - Final data with log_id
    - event: error - Error information
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

    service = MatchingService(db)

    async def generate() -> AsyncGenerator[str, None]:
        log_id = None
        full_npc_response = None
        match_result_data = None
        prompt_info = None

        try:
            async for event in service.simulate_stream(request):
                event_type = event["event"]
                data = event["data"]

                if event_type == "match_result":
                    match_result_data = data
                    yield f"event: match_result\ndata: {json.dumps(data)}\n\n"

                elif event_type == "npc_chunk":
                    yield f"event: npc_chunk\ndata: {json.dumps(data)}\n\n"

                elif event_type == "complete":
                    full_npc_response = data.get("npc_response")
                    prompt_info = data.get("prompt_info")
                    npc_llm_usage = data.get("npc_llm_usage")

                    # Save dialogue log if requested
                    if request.save_log and match_result_data:
                        session_id = request.session_id or str(uuid4())
                        debug_info_to_save = match_result_data.get("debug_info", {}).copy()
                        debug_info_to_save["prompt_info"] = prompt_info

                        # Build LLM usage info from both matching and NPC
                        llm_usage_to_save = {}
                        if match_result_data.get("matching_llm_usage"):
                            llm_usage_to_save["matching_tokens"] = match_result_data["matching_llm_usage"].get("matching_tokens")
                            llm_usage_to_save["matching_latency_ms"] = match_result_data["matching_llm_usage"].get("matching_latency_ms")
                            llm_usage_to_save["matching_model"] = match_result_data["matching_llm_usage"].get("matching_model")
                        if npc_llm_usage:
                            llm_usage_to_save["npc_tokens"] = npc_llm_usage.get("npc_tokens")
                            llm_usage_to_save["npc_latency_ms"] = npc_llm_usage.get("npc_latency_ms")
                            llm_usage_to_save["npc_model"] = npc_llm_usage.get("npc_model")
                        if llm_usage_to_save:
                            debug_info_to_save["llm_usage"] = llm_usage_to_save

                        log = DialogueLog(
                            session_id=session_id,
                            username=request.username,
                            script_id=request.script_id,
                            npc_id=request.npc_id,
                            player_message=request.player_message,
                            npc_response=full_npc_response,
                            context={
                                "unlocked_clue_ids": request.unlocked_clue_ids,
                                "matching_strategy": request.matching_strategy.value,
                                "template_id": request.template_id,
                                "llm_config_id": request.llm_config_id,
                                "npc_clue_template_id": request.npc_clue_template_id,
                                "npc_no_clue_template_id": request.npc_no_clue_template_id,
                                "npc_chat_config_id": request.npc_chat_config_id,
                            },
                            matched_clues=match_result_data.get("matched_clues", []),
                            triggered_clues=[tc["clue_id"] for tc in match_result_data.get("triggered_clues", [])],
                            debug_info=debug_info_to_save,
                        )
                        db.add(log)
                        await db.commit()
                        await db.refresh(log)
                        log_id = log.id
                        logger.info(f"Saved streaming dialogue log: {log_id}")

                    data["log_id"] = log_id
                    yield f"event: complete\ndata: {json.dumps(data)}\n\n"

        except httpx.TimeoutException as e:
            logger.error(f"LLM request timeout: {e}")
            yield f"event: error\ndata: {json.dumps({'error': 'LLM 响应超时', 'code': 'TIMEOUT'})}\n\n"
        except httpx.HTTPStatusError as e:
            logger.error(f"LLM HTTP error: {e}")
            yield f"event: error\ndata: {json.dumps({'error': f'LLM 服务错误: {e.response.status_code}', 'code': 'LLM_ERROR'})}\n\n"
        except Exception as e:
            logger.error(f"Streaming simulation failed: {e}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e), 'code': 'INTERNAL_ERROR'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
