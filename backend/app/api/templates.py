"""PromptTemplate API endpoints."""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.database import DBSession
from app.models.prompt_template import (
    PromptTemplate,
    TemplateScopeType,
    TemplateStatus,
    TemplateType,
)
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
router = APIRouter()


@router.get("/templates", response_model=PaginatedResponse[PromptTemplateResponse])
async def list_templates(
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    type: str | None = Query(default=None, description="Filter by template type"),
    scope_type: str | None = Query(default=None, description="Filter by scope type"),
    scope_target_id: str | None = Query(default=None, description="Filter by scope target ID"),
    status_filter: str | None = Query(default=None, alias="status", description="Filter by status"),
    search: str | None = Query(default=None, description="Search by name"),
) -> PaginatedResponse[PromptTemplateResponse]:
    """
    List all prompt templates with pagination and filtering.

    Args:
        db: Database session.
        Various filter parameters.

    Returns:
        Paginated list of templates.
    """
    # Build query
    query = select(PromptTemplate)

    if type:
        query = query.where(PromptTemplate.type == TemplateType(type))

    if scope_type:
        query = query.where(PromptTemplate.scope_type == TemplateScopeType(scope_type))

    if scope_target_id:
        query = query.where(PromptTemplate.scope_target_id == scope_target_id)

    if status_filter:
        query = query.where(PromptTemplate.status == TemplateStatus(status_filter))

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


@router.post("/templates", response_model=PromptTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    db: DBSession,
    template_data: PromptTemplateCreate,
) -> PromptTemplateResponse:
    """
    Create a new prompt template.

    Args:
        db: Database session.
        template_data: Template creation data.

    Returns:
        Created template.
    """
    # Extract variables from template content
    variables = template_renderer.extract_variables(template_data.content)
    variables_meta = {
        "extracted_variables": variables,
        "variable_count": len(variables),
    }

    template = PromptTemplate(
        id=str(uuid4()),
        name=template_data.name,
        description=template_data.description,
        type=TemplateType(template_data.type),
        scope_type=TemplateScopeType(template_data.scope_type),
        scope_target_id=template_data.scope_target_id,
        content=template_data.content,
        variables_meta=variables_meta,
        status=TemplateStatus(template_data.status),
        created_by=template_data.created_by,
    )

    db.add(template)
    await db.flush()
    await db.refresh(template)

    logger.info(f"Created prompt template: {template.id}")
    return PromptTemplateResponse.model_validate(template)


@router.get("/templates/{template_id}", response_model=PromptTemplateResponse)
async def get_template(
    db: DBSession,
    template_id: str,
) -> PromptTemplateResponse:
    """
    Get a prompt template by ID.

    Args:
        db: Database session.
        template_id: Template ID.

    Returns:
        Template details.

    Raises:
        HTTPException: If template not found.
    """
    result = await db.execute(select(PromptTemplate).where(PromptTemplate.id == template_id))
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    return PromptTemplateResponse.model_validate(template)


@router.put("/templates/{template_id}", response_model=PromptTemplateResponse)
async def update_template(
    db: DBSession,
    template_id: str,
    template_data: PromptTemplateUpdate,
) -> PromptTemplateResponse:
    """
    Update an existing prompt template.

    Args:
        db: Database session.
        template_id: Template ID.
        template_data: Template update data.

    Returns:
        Updated template.

    Raises:
        HTTPException: If template not found.
    """
    result = await db.execute(select(PromptTemplate).where(PromptTemplate.id == template_id))
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    # Update fields
    update_data = template_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "type" and value:
            setattr(template, field, TemplateType(value))
        elif field == "scope_type" and value:
            setattr(template, field, TemplateScopeType(value))
        elif field == "status" and value:
            setattr(template, field, TemplateStatus(value))
        else:
            setattr(template, field, value)

    # Update variables_meta if content changed
    if template_data.content:
        variables = template_renderer.extract_variables(template_data.content)
        template.variables_meta = {
            "extracted_variables": variables,
            "variable_count": len(variables),
        }

    await db.flush()
    await db.refresh(template)

    logger.info(f"Updated prompt template: {template.id}")
    return PromptTemplateResponse.model_validate(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    db: DBSession,
    template_id: str,
) -> None:
    """
    Delete a prompt template.

    Args:
        db: Database session.
        template_id: Template ID.

    Raises:
        HTTPException: If template not found.
    """
    result = await db.execute(select(PromptTemplate).where(PromptTemplate.id == template_id))
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )

    await db.delete(template)
    await db.flush()

    logger.info(f"Deleted prompt template: {template_id}")


@router.post("/templates/{template_id}/duplicate", response_model=PromptTemplateResponse)
async def duplicate_template(
    db: DBSession,
    template_id: str,
) -> PromptTemplateResponse:
    """
    Duplicate a prompt template.

    Args:
        db: Database session.
        template_id: Template ID to duplicate.

    Returns:
        Duplicated template.

    Raises:
        HTTPException: If template not found.
    """
    result = await db.execute(select(PromptTemplate).where(PromptTemplate.id == template_id))
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
        scope_type=template.scope_type,
        scope_target_id=template.scope_target_id,
        content=template.content,
        variables_meta=template.variables_meta,
        status=TemplateStatus.DRAFT,
    )

    db.add(new_template)
    await db.flush()
    await db.refresh(new_template)

    logger.info(f"Duplicated prompt template: {template_id} -> {new_template.id}")
    return PromptTemplateResponse.model_validate(new_template)


@router.post("/templates/render", response_model=TemplateRenderResponse)
async def render_template(
    db: DBSession,
    render_request: TemplateRenderRequest,
) -> TemplateRenderResponse:
    """
    Render a template with the given context.

    Args:
        db: Database session.
        render_request: Render request with template and context.

    Returns:
        Rendered template content.

    Raises:
        HTTPException: If template_id provided but not found.
    """
    template_content = render_request.template_content

    # If template_id is provided, fetch the template content
    if render_request.template_id and not template_content:
        result = await db.execute(
            select(PromptTemplate).where(PromptTemplate.id == render_request.template_id)
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


@router.get("/templates/variables/available", response_model=AvailableVariablesResponse)
async def get_available_variables() -> AvailableVariablesResponse:
    """
    Get all available template variables organized by category.

    Returns:
        Available variables response with all categories.
    """
    return template_renderer.get_available_variables()
