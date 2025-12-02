"""Script creation from story draft."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clue import Clue, ClueType
from app.models.npc import NPC
from app.models.script import Script
from app.schemas.ai_assistant import StoryDraft

logger = logging.getLogger(__name__)


class ScriptBuilder:
    """Creates Script, NPCs, and Clues from a story draft."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with database session."""
        self.db = db

    async def create_from_draft(self, draft: StoryDraft) -> Script:
        """
        Create actual Script, NPCs, and Clues from a story draft.

        Args:
            draft: Complete story draft with all details.

        Returns:
            Created Script model.
        """
        # Create script
        script = Script(
            title=draft.title,
            summary=draft.summary,
            background=draft.background,
            difficulty=draft.difficulty,
            truth=draft.truth,
        )
        self.db.add(script)
        await self.db.flush()

        # Map temp_id to actual IDs
        npc_id_map: dict[str, str] = {}
        clue_id_map: dict[str, str] = {}

        # Create NPCs
        for npc_suggestion in draft.npcs:
            npc_detail = next(
                (d for d in draft.npc_details if d.temp_id == npc_suggestion.temp_id),
                None,
            )

            npc = NPC(
                script_id=script.id,
                name=npc_suggestion.name,
                age=npc_suggestion.age,
                background=npc_detail.background if npc_detail else npc_suggestion.background_summary,
                personality=npc_detail.personality if npc_detail else ", ".join(npc_suggestion.personality_traits),
                knowledge_scope={
                    "knows": npc_detail.knowledge_scope.knows if npc_detail else [],
                    "does_not_know": npc_detail.knowledge_scope.does_not_know if npc_detail else [],
                    "world_model_limits": npc_detail.knowledge_scope.world_model_limits if npc_detail else [],
                },
            )
            self.db.add(npc)
            await self.db.flush()
            npc_id_map[npc_suggestion.temp_id] = npc.id

        # Build clue to NPC map
        clue_to_npc: dict[str, str] = {}
        for npc_suggestion in draft.npcs:
            for clue_temp_id in npc_suggestion.assigned_clue_temp_ids:
                clue_to_npc[clue_temp_id] = npc_id_map[npc_suggestion.temp_id]

        # Create clues (first pass - without prereq_clue_ids)
        for node in draft.clue_chain.nodes:
            clue_detail = next(
                (d for d in draft.clue_details if d.temp_id == node.temp_id),
                None,
            )

            npc_id = clue_to_npc.get(node.temp_id)
            if not npc_id:
                # Assign to first NPC if not assigned
                npc_id = list(npc_id_map.values())[0]

            clue = Clue(
                script_id=script.id,
                npc_id=npc_id,
                name=node.name,
                type=ClueType.TEXT,
                detail=clue_detail.detail if clue_detail else node.description,
                detail_for_npc=clue_detail.detail_for_npc if clue_detail else "",
                trigger_keywords=clue_detail.trigger_keywords if clue_detail else [],
                trigger_semantic_summary=clue_detail.trigger_semantic_summary if clue_detail else node.reasoning_role,
                prereq_clue_ids=[],  # Will update in second pass
            )
            self.db.add(clue)
            await self.db.flush()
            clue_id_map[node.temp_id] = clue.id

        # Second pass - update prereq_clue_ids
        for node in draft.clue_chain.nodes:
            if node.prereq_temp_ids:
                clue_id = clue_id_map[node.temp_id]
                prereq_ids = [clue_id_map[pid] for pid in node.prereq_temp_ids if pid in clue_id_map]

                result = await self.db.execute(select(Clue).where(Clue.id == clue_id))
                clue = result.scalar_one()
                clue.prereq_clue_ids = prereq_ids

        await self.db.commit()
        await self.db.refresh(script)

        return script
