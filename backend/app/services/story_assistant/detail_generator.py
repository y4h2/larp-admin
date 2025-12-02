"""Detail generation for clues and NPCs."""

import logging

from app.models.llm_config import LLMConfig
from app.schemas.ai_assistant import (
    ClueDetail,
    ClueNode,
    DetailFillResponse,
    GenerateDetailsRequest,
    NPCDetail,
    NPCKnowledgeScopePreview,
    NPCSuggestion,
    SelectedTruth,
    StorySettingInput,
)

from .llm_base import LLMBase

logger = logging.getLogger(__name__)


class DetailGenerator(LLMBase):
    """Generates detailed content for clues and NPCs."""

    async def generate(
        self,
        request: GenerateDetailsRequest,
    ) -> DetailFillResponse:
        """
        Generate detailed content for clues and NPCs.

        Args:
            request: Contains all previous generation results.

        Returns:
            Detailed content for clues and NPCs.
        """
        config = await self._get_chat_config(request.llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        # Determine which clues to generate
        clue_temp_ids = request.clue_temp_ids
        if not clue_temp_ids:
            clue_temp_ids = [n.temp_id for n in request.clue_chain.nodes]

        # Build NPC assignment map
        npc_clue_map: dict[str, str] = {}
        for npc in request.npcs:
            for clue_id in npc.assigned_clue_temp_ids:
                npc_clue_map[clue_id] = npc.name

        # Generate clue details
        clue_details = []
        for node in request.clue_chain.nodes:
            if node.temp_id in clue_temp_ids:
                detail = await self._generate_clue_detail(
                    config, node, request.setting, request.truth,
                    npc_clue_map.get(node.temp_id, "Unknown NPC"),
                )
                clue_details.append(detail)

        # Generate NPC details
        npc_details = []
        for npc in request.npcs:
            detail = await self._generate_npc_detail(
                config, npc, request.setting, request.truth,
            )
            npc_details.append(detail)

        return DetailFillResponse(
            clue_details=clue_details,
            npc_details=npc_details,
            progress=1.0,
        )

    async def _generate_clue_detail(
        self,
        config: LLMConfig,
        node: ClueNode,
        setting: StorySettingInput,
        truth: SelectedTruth,
        npc_name: str,
    ) -> ClueDetail:
        """Generate detailed content for a single clue."""
        system_prompt = """You are an expert mystery game content writer.

Your response must be valid JSON:
{
  "detail": "The actual clue content that players discover",
  "detail_for_npc": "Guidance for NPC on how to reveal this clue naturally",
  "trigger_keywords": ["keyword1", "keyword2"],
  "trigger_semantic_summary": "Description of when this clue should be triggered"
}

Writing principles:
1. detail: Write as the actual evidence/information, not meta-description
2. detail_for_npc: Write from NPC's perspective, how they would reveal this
3. trigger_keywords: 3-6 keywords players might use
4. trigger_semantic_summary: Describe the situations that trigger this clue"""

        user_prompt = f"""Generate detailed content for this clue:

【Setting】
Era: {setting.era}, Location: {setting.location}

【Clue Info】
Name: {node.name}
Description: {node.description}
Reasoning Role: {node.reasoning_role}
Held by NPC: {npc_name}

【Context】
Murderer: {truth.murderer}
Motive: {truth.motive}
Method: {truth.method}

Generate the detailed content now."""

        response = await self._call_llm_json(config, system_prompt, user_prompt)

        return ClueDetail(
            temp_id=node.temp_id,
            name=node.name,
            detail=response.get("detail", ""),
            detail_for_npc=response.get("detail_for_npc", ""),
            trigger_keywords=response.get("trigger_keywords", []),
            trigger_semantic_summary=response.get("trigger_semantic_summary", ""),
        )

    async def _generate_npc_detail(
        self,
        config: LLMConfig,
        npc: NPCSuggestion,
        setting: StorySettingInput,
        truth: SelectedTruth,
    ) -> NPCDetail:
        """Generate detailed content for a single NPC."""
        system_prompt = """You are an expert character designer for mystery games.

Your response must be valid JSON:
{
  "background": "Detailed character background (2-3 paragraphs)",
  "personality": "Detailed personality description",
  "knowledge_scope": {
    "knows": ["detailed knowledge items"],
    "does_not_know": ["what they don't know"],
    "world_model_limits": ["their worldview limitations"]
  }
}

Writing principles:
1. Background should explain why they have their clues
2. Personality should guide how they interact with players
3. Knowledge scope must be specific and consistent"""

        clue_ids = ", ".join(npc.assigned_clue_temp_ids)

        user_prompt = f"""Generate detailed content for this NPC:

【Setting】
Era: {setting.era}, Location: {setting.location}

【NPC Info】
Name: {npc.name}
Role: {npc.role}
Age: {npc.age or 'Not specified'}
Background Summary: {npc.background_summary}
Personality Traits: {', '.join(npc.personality_traits)}
Assigned Clues: {clue_ids}

【Context】
Murderer: {truth.murderer}
(NPC should not directly know this unless they are the murderer)

Generate the detailed content now."""

        response = await self._call_llm_json(config, system_prompt, user_prompt)

        ks = response.get("knowledge_scope", {})

        return NPCDetail(
            temp_id=npc.temp_id,
            name=npc.name,
            age=npc.age,
            background=response.get("background", ""),
            personality=response.get("personality", ""),
            knowledge_scope=NPCKnowledgeScopePreview(
                knows=ks.get("knows", []),
                does_not_know=ks.get("does_not_know", []),
                world_model_limits=ks.get("world_model_limits", []),
            ),
        )
