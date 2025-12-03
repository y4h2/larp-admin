"""PromptTemplate API endpoints."""

import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.database import DBSession
from app.models.prompt_template import PromptTemplate, TemplateType
from app.schemas.common import PaginatedResponse
from app.schemas.prompt_template import (
    AvailableVariablesResponse,
    TemplateCreate,
    TemplateRenderRequest,
    TemplateRenderResponse,
    TemplateResponse,
    TemplateUpdate,
)
from app.services.template import template_renderer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/templates", tags=["templates"])


# ============ CRUD Endpoints ============


@router.get("", response_model=PaginatedResponse[TemplateResponse])
async def list_templates(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    type: str | None = Query(default=None),
    search: str | None = Query(default=None),
) -> PaginatedResponse[TemplateResponse]:
    """List templates with pagination and filtering."""
    query = select(PromptTemplate).where(PromptTemplate.deleted_at.is_(None))

    # Apply filters
    if type:
        query = query.where(PromptTemplate.type == type)
    if search:
        query = query.where(PromptTemplate.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(PromptTemplate.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = [TemplateResponse.model_validate(t) for t in result.scalars().all()]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/defaults", response_model=dict[str, TemplateResponse | None])
async def get_default_templates(
    db: DBSession,
) -> dict[str, TemplateResponse | None]:
    """Get default templates for each type."""
    result = await db.execute(
        select(PromptTemplate)
        .where(PromptTemplate.deleted_at.is_(None))
        .where(PromptTemplate.is_default.is_(True))
    )
    templates = result.scalars().all()

    defaults: dict[str, TemplateResponse | None] = {
        "clue_embedding": None,
        "npc_system_prompt": None,
        "clue_reveal": None,
        "custom": None,
    }

    for t in templates:
        defaults[t.type.value] = TemplateResponse.model_validate(t)

    return defaults


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    db: DBSession,
    data: TemplateCreate,
) -> TemplateResponse:
    """Create a new template."""
    # If setting as default, unset other defaults first
    if data.is_default:
        await db.execute(
            select(PromptTemplate)
            .where(PromptTemplate.type == data.type)
            .where(PromptTemplate.is_default.is_(True))
        )
        result = await db.execute(
            select(PromptTemplate)
            .where(PromptTemplate.type == data.type)
            .where(PromptTemplate.is_default.is_(True))
        )
        for t in result.scalars().all():
            t.is_default = False

    template = PromptTemplate(
        id=str(uuid4()),
        name=data.name,
        description=data.description,
        type=TemplateType(data.type),
        content=data.content,
        is_default=data.is_default,
        variables=data.extract_variables(),
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)

    logger.info(f"Created template {template.id}: {template.name}")
    return TemplateResponse.model_validate(template)


# ============ Utility Endpoints ============
# NOTE: These must be defined BEFORE /{template_id} routes to avoid path conflicts


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


# ============ Single Template CRUD (with path parameter) ============


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    db: DBSession,
    template_id: str,
) -> TemplateResponse:
    """Get a template by ID."""
    result = await db.execute(
        select(PromptTemplate)
        .where(PromptTemplate.id == template_id)
        .where(PromptTemplate.deleted_at.is_(None))
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    return TemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    db: DBSession,
    template_id: str,
    data: TemplateUpdate,
) -> TemplateResponse:
    """Update a template."""
    result = await db.execute(
        select(PromptTemplate)
        .where(PromptTemplate.id == template_id)
        .where(PromptTemplate.deleted_at.is_(None))
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    # If setting as default, unset other defaults first
    if data.is_default:
        target_type = data.type or template.type.value
        unset_result = await db.execute(
            select(PromptTemplate)
            .where(PromptTemplate.type == target_type)
            .where(PromptTemplate.is_default.is_(True))
            .where(PromptTemplate.id != template_id)
        )
        for t in unset_result.scalars().all():
            t.is_default = False

    # Update fields
    if data.name is not None:
        template.name = data.name
    if data.description is not None:
        template.description = data.description
    if data.type is not None:
        template.type = TemplateType(data.type)
    if data.content is not None:
        template.content = data.content
        template.variables = data.extract_variables() or []
    if data.is_default is not None:
        template.is_default = data.is_default

    await db.flush()
    await db.refresh(template)

    logger.info(f"Updated template {template_id}")
    return TemplateResponse.model_validate(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    db: DBSession,
    template_id: str,
) -> None:
    """Soft delete a template."""
    result = await db.execute(
        select(PromptTemplate)
        .where(PromptTemplate.id == template_id)
        .where(PromptTemplate.deleted_at.is_(None))
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    template.deleted_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(f"Soft deleted template {template_id}")


@router.post("/{template_id}/duplicate", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_template(
    db: DBSession,
    template_id: str,
) -> TemplateResponse:
    """Duplicate a template."""
    result = await db.execute(
        select(PromptTemplate)
        .where(PromptTemplate.id == template_id)
        .where(PromptTemplate.deleted_at.is_(None))
    )
    original = result.scalars().first()

    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    new_template = PromptTemplate(
        id=str(uuid4()),
        name=f"{original.name} (Copy)",
        description=original.description,
        type=original.type,
        content=original.content,
        is_default=False,
        variables=original.variables,
    )
    db.add(new_template)
    await db.flush()
    await db.refresh(new_template)

    logger.info(f"Duplicated template {template_id} to {new_template.id}")
    return TemplateResponse.model_validate(new_template)


@router.post("/{template_id}/set-default", response_model=TemplateResponse)
async def set_default_template(
    db: DBSession,
    template_id: str,
) -> TemplateResponse:
    """Set a template as the default for its type."""
    result = await db.execute(
        select(PromptTemplate)
        .where(PromptTemplate.id == template_id)
        .where(PromptTemplate.deleted_at.is_(None))
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    # Unset other defaults of the same type
    unset_result = await db.execute(
        select(PromptTemplate)
        .where(PromptTemplate.type == template.type)
        .where(PromptTemplate.is_default.is_(True))
    )
    for t in unset_result.scalars().all():
        t.is_default = False

    template.is_default = True
    await db.flush()
    await db.refresh(template)

    logger.info(f"Set template {template_id} as default for type {template.type.value}")
    return TemplateResponse.model_validate(template)
