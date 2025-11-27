"""PromptTemplate API endpoints.

Only render and variables endpoints are kept here.
CRUD operations are now handled via Supabase PostgREST.
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.database import DBSession
from app.models.prompt_template import PromptTemplate
from app.schemas.prompt_template import (
    AvailableVariablesResponse,
    TemplateRenderRequest,
    TemplateRenderResponse,
)
from app.services.template_renderer import template_renderer

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/variables", response_model=AvailableVariablesResponse)
async def get_available_variables() -> AvailableVariablesResponse:
    """Get all available template variables organized by category.

    These variables can be used in templates with jsonpath-style access:
    - {clue.name}, {clue.detail}
    - {npc.name}, {npc.knowledge_scope.knows}
    - {script.title}, {script.truth.murderer}
    """
    return template_renderer.get_available_variables()


@router.post("/render", response_model=TemplateRenderResponse)
async def render_template(
    db: DBSession,
    render_request: TemplateRenderRequest,
) -> TemplateRenderResponse:
    """Render a template with the given context.

    Context should contain objects like:
    - clue: {name: "...", detail: "...", trigger_keywords: [...]}
    - npc: {name: "...", personality: "...", knowledge_scope: {...}}
    - script: {title: "...", truth: {...}}

    Example:
        POST /templates/render
        {
            "template_content": "{clue.name}:{clue.detail}",
            "context": {
                "clue": {"name": "Murder Weapon", "detail": "A bloody knife"}
            }
        }
        # Returns: {"rendered_content": "Murder Weapon:A bloody knife", ...}
    """
    template_content = render_request.template_content

    # If template_id is provided, fetch the template content
    if render_request.template_id and not template_content:
        result = await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.id == render_request.template_id,
                PromptTemplate.deleted_at.is_(None),
            )
        )
        template = result.scalars().first()

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with id {render_request.template_id} not found",
            )

        template_content = template.content

    if not template_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either template_id or template_content must be provided",
        )

    return template_renderer.render(template_content, render_request.context)
