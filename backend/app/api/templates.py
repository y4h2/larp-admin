"""PromptTemplate API endpoints.

Supports template syntax like '{clue.name}:{clue.detail}' with jsonpath-style
nested field access.
"""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.database import DBSession
from app.models.prompt_template import PromptTemplate, TemplateType
from app.schemas.common import PaginatedResponse
from app.schemas.prompt_template import (
    AvailableVariablesResponse,
    PromptTemplateCreate,
    PromptTemplateResponse,
    PromptTemplateUpdate,
    TemplateRenderRequest,
    TemplateRenderResponse,
)
from app.services.template_renderer import template_renderer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=PaginatedResponse[PromptTemplateResponse])
async def list_templates(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    type: str | None = Query(default=None, description="Filter by template type"),
    search: str | None = Query(default=None, description="Search by name"),
) -> PaginatedResponse[PromptTemplateResponse]:
    """List all prompt templates with pagination and filtering."""
    query = select(PromptTemplate).where(PromptTemplate.deleted_at.is_(None))

    if type:
        query = query.where(PromptTemplate.type == TemplateType(type))

    if search:
        query = query.where(PromptTemplate.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    offset = (page - 1) * page_size
    query = query.order_by(PromptTemplate.updated_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    templates = result.scalars().all()

    items = [PromptTemplateResponse.model_validate(t) for t in templates]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=PromptTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    db: DBSession,
    template_data: PromptTemplateCreate,
) -> PromptTemplateResponse:
    """Create a new prompt template."""
    # If setting as default, unset other defaults of the same type
    if template_data.is_default:
        await _unset_default_for_type(db, template_data.type)

    # Extract variables from template content
    variables = template_renderer.extract_variables(template_data.content)

    template = PromptTemplate(
        id=str(uuid4()),
        name=template_data.name,
        description=template_data.description,
        type=TemplateType(template_data.type),
        content=template_data.content,
        is_default=template_data.is_default,
        variables=variables,
    )

    db.add(template)
    await db.flush()
    await db.refresh(template)

    logger.info(f"Created prompt template: {template.id}")
    return PromptTemplateResponse.model_validate(template)


@router.get("/defaults", response_model=dict[str, PromptTemplateResponse | None])
async def get_default_templates(
    db: DBSession,
) -> dict[str, PromptTemplateResponse | None]:
    """Get the default template for each type."""
    result = {}

    for template_type in TemplateType:
        query = select(PromptTemplate).where(
            PromptTemplate.deleted_at.is_(None),
            PromptTemplate.type == template_type,
            PromptTemplate.is_default.is_(True),
        )
        template = (await db.execute(query)).scalar_one_or_none()
        result[template_type.value] = (
            PromptTemplateResponse.model_validate(template) if template else None
        )

    return result


@router.get("/variables", response_model=AvailableVariablesResponse)
async def get_available_variables() -> AvailableVariablesResponse:
    """Get all available template variables organized by category.

    These variables can be used in templates with jsonpath-style access:
    - {clue.name}, {clue.detail}
    - {npc.name}, {npc.knowledge_scope.knows}
    - {script.title}, {script.truth.murderer}
    """
    return template_renderer.get_available_variables()


@router.get("/{template_id}", response_model=PromptTemplateResponse)
async def get_template(
    db: DBSession,
    template_id: str,
) -> PromptTemplateResponse:
    """Get a prompt template by ID."""
    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.deleted_at.is_(None),
        )
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    return PromptTemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=PromptTemplateResponse)
async def update_template(
    db: DBSession,
    template_id: str,
    template_data: PromptTemplateUpdate,
) -> PromptTemplateResponse:
    """Update an existing prompt template."""
    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.deleted_at.is_(None),
        )
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    # If setting as default, unset other defaults of the same type
    if template_data.is_default is True and not template.is_default:
        await _unset_default_for_type(db, template.type.value)

    # Update fields
    update_data = template_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "type" and value:
            setattr(template, field, TemplateType(value))
        else:
            setattr(template, field, value)

    # Update variables if content changed
    if template_data.content:
        template.variables = template_renderer.extract_variables(template_data.content)

    await db.flush()
    await db.refresh(template)

    logger.info(f"Updated prompt template: {template.id}")
    return PromptTemplateResponse.model_validate(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    db: DBSession,
    template_id: str,
) -> None:
    """Soft delete a prompt template."""
    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.deleted_at.is_(None),
        )
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    template.deleted_at = func.now()
    await db.commit()

    logger.info(f"Deleted prompt template: {template_id}")


@router.post("/{template_id}/duplicate", response_model=PromptTemplateResponse)
async def duplicate_template(
    db: DBSession,
    template_id: str,
) -> PromptTemplateResponse:
    """Duplicate a prompt template."""
    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.deleted_at.is_(None),
        )
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    new_template = PromptTemplate(
        id=str(uuid4()),
        name=f"{template.name} (Copy)",
        description=template.description,
        type=template.type,
        content=template.content,
        is_default=False,
        variables=template.variables,
    )

    db.add(new_template)
    await db.flush()
    await db.refresh(new_template)

    logger.info(f"Duplicated prompt template: {template_id} -> {new_template.id}")
    return PromptTemplateResponse.model_validate(new_template)


@router.post("/{template_id}/set-default", response_model=PromptTemplateResponse)
async def set_default_template(
    db: DBSession,
    template_id: str,
) -> PromptTemplateResponse:
    """Set a template as the default for its type."""
    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.deleted_at.is_(None),
        )
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    # Unset other defaults of the same type
    await _unset_default_for_type(db, template.type.value)

    # Set this one as default
    template.is_default = True
    await db.flush()
    await db.refresh(template)

    logger.info(f"Set template {template_id} as default for type {template.type}")
    return PromptTemplateResponse.model_validate(template)


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


async def _unset_default_for_type(db: DBSession, template_type: str) -> None:
    """Unset is_default for all templates of the given type."""
    query = select(PromptTemplate).where(
        PromptTemplate.deleted_at.is_(None),
        PromptTemplate.type == template_type,
        PromptTemplate.is_default.is_(True),
    )
    result = await db.execute(query)
    templates = result.scalars().all()

    for template in templates:
        template.is_default = False
