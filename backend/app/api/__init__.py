"""API routes for the LARP Admin application."""

from fastapi import APIRouter

from app.api.ai_assistant import router as ai_assistant_router
from app.api.ai_enhancement import router as ai_enhancement_router
from app.api.clues import router as clues_router
from app.api.debug_audit_logs import router as debug_audit_logs_router
from app.api.logs import router as logs_router
from app.api.scripts import router as scripts_router
from app.api.simulate import router as simulate_router
from app.api.templates import router as templates_router

api_router = APIRouter()

api_router.include_router(scripts_router, prefix="/scripts", tags=["scripts"])
api_router.include_router(clues_router, tags=["clues"])
api_router.include_router(simulate_router, prefix="/simulate", tags=["simulate"])
api_router.include_router(logs_router, prefix="/logs", tags=["logs"])
api_router.include_router(templates_router)
api_router.include_router(debug_audit_logs_router, prefix="/debug-audit-logs", tags=["debug-audit-logs"])
api_router.include_router(ai_assistant_router, prefix="/ai-assistant", tags=["ai-assistant"])
api_router.include_router(ai_enhancement_router, prefix="/ai-enhance", tags=["ai-enhance"])
# llm_configs, npcs removed - now handled via Supabase PostgREST
# scripts, clues CRUD removed - only complex operations (copy/export/import, clue-tree) kept
