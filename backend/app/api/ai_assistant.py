"""AI Story Creation Assistant API endpoints."""

import logging

from fastapi import APIRouter, HTTPException, status

from app.database import DBSession
from app.schemas.ai_assistant import (
    ClueChainSuggestion,
    CreateScriptFromDraftRequest,
    DetailFillResponse,
    GenerateClueChainRequest,
    GenerateDetailsRequest,
    GenerateNPCsRequest,
    GenerateTruthRequest,
    NPCAssignmentResponse,
    OptimizeClueChainRequest,
    StoryDraft,
    TruthOptionsResponse,
)
from app.services.ai_story_assistant import AIStoryAssistantService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generate-truth", response_model=TruthOptionsResponse)
async def generate_truth_options(
    db: DBSession,
    request: GenerateTruthRequest,
) -> TruthOptionsResponse:
    """
    Generate multiple truth options based on story setting.

    AI will generate 3 different murder mystery plots for the user to choose from.

    Args:
        db: Database session.
        request: Story setting and optional hints.

    Returns:
        Multiple truth options with recommendations.
    """
    try:
        service = AIStoryAssistantService(db)
        return await service.generate_truth_options(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to generate truth options")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate truth options: {str(e)}",
        )


@router.post("/generate-clue-chain", response_model=ClueChainSuggestion)
async def generate_clue_chain(
    db: DBSession,
    request: GenerateClueChainRequest,
) -> ClueChainSuggestion:
    """
    Generate a clue chain from the selected truth.

    Uses reverse reasoning to build a logical clue dependency graph.

    Args:
        db: Database session.
        request: Story setting, selected truth, and optional existing chain.

    Returns:
        Clue chain with nodes, edges, and validation results.
    """
    try:
        service = AIStoryAssistantService(db)
        return await service.generate_clue_chain(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to generate clue chain")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate clue chain: {str(e)}",
        )


@router.post("/optimize-clue-chain", response_model=ClueChainSuggestion)
async def optimize_clue_chain(
    db: DBSession,
    request: OptimizeClueChainRequest,
) -> ClueChainSuggestion:
    """
    Optimize an existing clue chain.

    Fixes issues found in validation and improves the chain structure.

    Args:
        db: Database session.
        request: Existing clue chain and optimization focus.

    Returns:
        Optimized clue chain with updated validation.
    """
    try:
        service = AIStoryAssistantService(db)
        return await service.optimize_clue_chain(
            request.clue_chain,
            request.focus,
            request.llm_config_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to optimize clue chain")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to optimize clue chain: {str(e)}",
        )


@router.post("/generate-npcs", response_model=NPCAssignmentResponse)
async def generate_npcs(
    db: DBSession,
    request: GenerateNPCsRequest,
) -> NPCAssignmentResponse:
    """
    Generate NPCs and assign clues to them.

    Creates NPCs that fit the story setting and assigns clues based on
    their backgrounds and the clue chain structure.

    Args:
        db: Database session.
        request: Story setting, truth, clue chain, and NPC count.

    Returns:
        List of NPCs with assigned clues.
    """
    try:
        service = AIStoryAssistantService(db)
        return await service.generate_npcs(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to generate NPCs")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate NPCs: {str(e)}",
        )


@router.post("/generate-details", response_model=DetailFillResponse)
async def generate_details(
    db: DBSession,
    request: GenerateDetailsRequest,
) -> DetailFillResponse:
    """
    Generate detailed content for clues and NPCs.

    Fills in the detail, detail_for_npc, trigger_keywords, etc. for clues,
    and full background, personality for NPCs.

    Args:
        db: Database session.
        request: All previous generation results.

    Returns:
        Detailed content for clues and NPCs.
    """
    try:
        service = AIStoryAssistantService(db)
        return await service.generate_details(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to generate details")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate details: {str(e)}",
        )


@router.post("/create-script", response_model=dict)
async def create_script_from_draft(
    db: DBSession,
    request: CreateScriptFromDraftRequest,
) -> dict:
    """
    Create actual Script, NPCs, and Clues from a story draft.

    This is the final step that persists the AI-generated content
    to the database as real entities.

    Args:
        db: Database session.
        request: Complete story draft.

    Returns:
        Created script ID and summary.
    """
    try:
        service = AIStoryAssistantService(db)
        script = await service.create_script_from_draft(request.draft)
        return {
            "script_id": script.id,
            "title": script.title,
            "message": "Script created successfully",
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to create script from draft")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create script: {str(e)}",
        )


@router.post("/validate-clue-chain", response_model=dict)
async def validate_clue_chain(
    request: ClueChainSuggestion,
) -> dict:
    """
    Validate a clue chain without LLM.

    Performs structural validation on the clue chain graph.

    Args:
        request: Clue chain to validate.

    Returns:
        Validation results.
    """
    from app.services.ai_story_assistant import AIStoryAssistantService

    # Use static method for validation (no DB needed)
    validation = AIStoryAssistantService._validate_clue_chain(
        None,  # self not needed for this method
        request.nodes,
        request.edges,
    )

    return validation.model_dump()
