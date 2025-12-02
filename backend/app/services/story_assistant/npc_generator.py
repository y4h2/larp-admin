"""NPC generation and clue assignment."""

import logging

from app.schemas.ai_assistant import (
    GenerateNPCsRequest,
    NPCAssignmentResponse,
    NPCSuggestion,
)

from .llm_base import LLMBase

logger = logging.getLogger(__name__)


class NPCGenerator(LLMBase):
    """Generates NPCs and assigns clues to them."""

    async def generate(
        self,
        request: GenerateNPCsRequest,
    ) -> NPCAssignmentResponse:
        """
        Generate NPCs and assign clues to them.

        Args:
            request: Contains setting, truth, clue chain, and NPC count.

        Returns:
            List of NPCs with assigned clues.
        """
        config = await self._get_chat_config(request.llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        # Prepare clue info for prompt
        clue_info = "\n".join([
            f"- {n.temp_id}: {n.name} ({n.importance.value}) - {n.reasoning_role}"
            + (f" [Suggested: {n.suggested_npc_role}]" if n.suggested_npc_role else "")
            for n in request.clue_chain.nodes
        ])

        system_prompt = """You are an expert at creating NPCs for mystery games.

Your response must be valid JSON matching this structure:
{
  "npcs": [
    {
      "temp_id": "npc_001",
      "name": "Character Name",
      "role": "Their role/identity",
      "age": 45,
      "background_summary": "Brief background",
      "personality_traits": ["trait1", "trait2"],
      "assigned_clue_temp_ids": ["clue_001", "clue_005"],
      "knowledge_scope_preview": {
        "knows": ["what they know"],
        "does_not_know": ["what they don't know"],
        "world_model_limits": ["their limitations"]
      }
    }
  ],
  "unassigned_clue_temp_ids": [],
  "ai_notes": ["Notes about the design"]
}

Design principles:
1. Each NPC should have 2-5 clues
2. Related clues should go to the same NPC when possible
3. Critical clues should be distributed across multiple NPCs
4. NPC backgrounds must justify why they have certain clues
5. Knowledge scope must be consistent with assigned clues"""

        user_prompt = f"""Create {request.npc_count} NPCs for this mystery:

【Setting】
Genre: {request.setting.genre.value}
Era: {request.setting.era}
Location: {request.setting.location}

【Truth】
Murderer: {request.truth.murderer}
Motive: {request.truth.motive}
Method: {request.truth.method}

【Clues to Assign】
{clue_info}

Create {request.npc_count} NPCs and assign all clues appropriately."""

        response = await self._call_llm_json(config, system_prompt, user_prompt)

        npcs = [NPCSuggestion.model_validate(n) for n in response.get("npcs", [])]
        unassigned = response.get("unassigned_clue_temp_ids", [])
        ai_notes = response.get("ai_notes", [])

        return NPCAssignmentResponse(
            npcs=npcs,
            unassigned_clue_temp_ids=unassigned,
            ai_notes=ai_notes,
        )
