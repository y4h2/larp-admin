"""API routes for AI enhancement features."""

import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.enhancement import AIEnhancementService

router = APIRouter()


class PolishClueRequest(BaseModel):
    """Request to polish clue detail."""

    clue_name: str = Field(..., description="Name of the clue")
    clue_detail: str = Field(..., description="Current clue detail text")
    context: str | None = Field(None, description="Story background context")
    llm_config_id: str | None = Field(None, description="LLM config to use")


class PolishClueResponse(BaseModel):
    """Response with polished clue detail."""

    polished_detail: str


class SuggestKeywordsRequest(BaseModel):
    """Request to suggest trigger keywords."""

    clue_name: str = Field(..., description="Name of the clue")
    clue_detail: str = Field(..., description="Clue detail text")
    existing_keywords: list[str] | None = Field(None, description="Already defined keywords")
    llm_config_id: str | None = Field(None, description="LLM config to use")


class SuggestKeywordsResponse(BaseModel):
    """Response with suggested keywords."""

    keywords: list[str]


class GenerateSemanticSummaryRequest(BaseModel):
    """Request to generate semantic summary."""

    clue_name: str = Field(..., description="Name of the clue")
    clue_detail: str = Field(..., description="Clue detail text")
    llm_config_id: str | None = Field(None, description="LLM config to use")


class GenerateSemanticSummaryResponse(BaseModel):
    """Response with semantic summary."""

    semantic_summary: str


class PolishNPCRequest(BaseModel):
    """Request to polish NPC description."""

    npc_name: str = Field(..., description="Name of the NPC")
    field: str = Field(..., description="Field to polish: background, personality, system_prompt")
    content: str = Field(..., description="Current content")
    context: str | None = Field(None, description="Story background context")
    llm_config_id: str | None = Field(None, description="LLM config to use")


class PolishNPCResponse(BaseModel):
    """Response with polished content."""

    polished_content: str


@router.post("/polish-clue", response_model=PolishClueResponse)
async def polish_clue(
    request: PolishClueRequest,
    db: AsyncSession = Depends(get_db),
) -> PolishClueResponse:
    """Polish and improve clue detail text."""
    try:
        service = AIEnhancementService(db)
        polished = await service.polish_clue_detail(
            clue_name=request.clue_name,
            clue_detail=request.clue_detail,
            context=request.context,
            llm_config_id=request.llm_config_id,
        )
        return PolishClueResponse(polished_detail=polished)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI enhancement failed: {str(e)}")


@router.post("/polish-clue/stream")
async def polish_clue_stream(
    request: PolishClueRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream polish clue response."""
    service = AIEnhancementService(db)

    async def generate() -> AsyncGenerator[str, None]:
        try:
            async for chunk in service.polish_clue_detail_stream(
                clue_name=request.clue_name,
                clue_detail=request.clue_detail,
                context=request.context,
                llm_config_id=request.llm_config_id,
            ):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except ValueError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'AI enhancement failed: {str(e)}'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/suggest-keywords", response_model=SuggestKeywordsResponse)
async def suggest_keywords(
    request: SuggestKeywordsRequest,
    db: AsyncSession = Depends(get_db),
) -> SuggestKeywordsResponse:
    """Suggest trigger keywords for a clue."""
    try:
        service = AIEnhancementService(db)
        keywords = await service.suggest_trigger_keywords(
            clue_name=request.clue_name,
            clue_detail=request.clue_detail,
            existing_keywords=request.existing_keywords,
            llm_config_id=request.llm_config_id,
        )
        return SuggestKeywordsResponse(keywords=keywords)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI enhancement failed: {str(e)}")


@router.post("/generate-semantic-summary", response_model=GenerateSemanticSummaryResponse)
async def generate_semantic_summary(
    request: GenerateSemanticSummaryRequest,
    db: AsyncSession = Depends(get_db),
) -> GenerateSemanticSummaryResponse:
    """Generate semantic summary for clue matching."""
    try:
        service = AIEnhancementService(db)
        summary = await service.generate_semantic_summary(
            clue_name=request.clue_name,
            clue_detail=request.clue_detail,
            llm_config_id=request.llm_config_id,
        )
        return GenerateSemanticSummaryResponse(semantic_summary=summary)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI enhancement failed: {str(e)}")


@router.post("/generate-semantic-summary/stream")
async def generate_semantic_summary_stream(
    request: GenerateSemanticSummaryRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream generate semantic summary response."""
    service = AIEnhancementService(db)

    async def generate() -> AsyncGenerator[str, None]:
        try:
            async for chunk in service.generate_semantic_summary_stream(
                clue_name=request.clue_name,
                clue_detail=request.clue_detail,
                llm_config_id=request.llm_config_id,
            ):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except ValueError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'AI enhancement failed: {str(e)}'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/polish-npc", response_model=PolishNPCResponse)
async def polish_npc(
    request: PolishNPCRequest,
    db: AsyncSession = Depends(get_db),
) -> PolishNPCResponse:
    """Polish NPC description fields."""
    try:
        service = AIEnhancementService(db)
        polished = await service.polish_npc_description(
            npc_name=request.npc_name,
            field=request.field,
            content=request.content,
            context=request.context,
            llm_config_id=request.llm_config_id,
        )
        return PolishNPCResponse(polished_content=polished)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI enhancement failed: {str(e)}")


@router.post("/polish-npc/stream")
async def polish_npc_stream(
    request: PolishNPCRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream polish NPC description response."""
    service = AIEnhancementService(db)

    async def generate() -> AsyncGenerator[str, None]:
        try:
            async for chunk in service.polish_npc_description_stream(
                npc_name=request.npc_name,
                field=request.field,
                content=request.content,
                context=request.context,
                llm_config_id=request.llm_config_id,
            ):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except ValueError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'AI enhancement failed: {str(e)}'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class ClueInfo(BaseModel):
    """Clue information for analysis."""

    id: str
    name: str
    detail: str | None = None
    prereq_clue_ids: list[str] = Field(default_factory=list)


class AnalyzeClueChainRequest(BaseModel):
    """Request to analyze clue chain logic."""

    clues: list[ClueInfo] = Field(..., description="List of clues to analyze")
    script_background: str | None = Field(None, description="Script background context")
    llm_config_id: str | None = Field(None, description="LLM config to use")


class ClueChainIssue(BaseModel):
    """An issue found in the clue chain."""

    type: str
    severity: str
    description: str
    affected_clues: list[str] = Field(default_factory=list)


class ClueChainSuggestion(BaseModel):
    """A suggestion for improving the clue chain."""

    type: str
    description: str
    priority: str


class AnalyzeClueChainResponse(BaseModel):
    """Response with clue chain analysis."""

    overall_score: int
    summary: str
    issues: list[ClueChainIssue] = Field(default_factory=list)
    suggestions: list[ClueChainSuggestion] = Field(default_factory=list)
    key_clues: list[str] = Field(default_factory=list)
    reasoning_paths: list[str] = Field(default_factory=list)


@router.post("/analyze-clue-chain", response_model=AnalyzeClueChainResponse)
async def analyze_clue_chain(
    request: AnalyzeClueChainRequest,
    db: AsyncSession = Depends(get_db),
) -> AnalyzeClueChainResponse:
    """Analyze clue chain logic and provide improvement suggestions."""
    try:
        service = AIEnhancementService(db)
        clues_data = [clue.model_dump() for clue in request.clues]
        result = await service.analyze_clue_chain(
            clues=clues_data,
            script_background=request.script_background,
            llm_config_id=request.llm_config_id,
        )
        return AnalyzeClueChainResponse(
            overall_score=result.get("overall_score", 5),
            summary=result.get("summary", ""),
            issues=[ClueChainIssue(**issue) for issue in result.get("issues", [])],
            suggestions=[ClueChainSuggestion(**sugg) for sugg in result.get("suggestions", [])],
            key_clues=result.get("key_clues", []),
            reasoning_paths=result.get("reasoning_paths", []),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")
