"""AI Story Creation Assistant Service.

This service provides AI-powered story creation capabilities including:
- Truth generation from story settings
- Clue chain generation with logical validation
- NPC generation and clue assignment
- Detail generation for clues and NPCs
"""

import json
import logging
from collections import defaultdict

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.clue import Clue, ClueType
from app.models.llm_config import LLMConfig, LLMConfigType
from app.models.npc import NPC
from app.models.script import Script
from app.schemas.ai_assistant import (
    ClueChainSuggestion,
    ClueChainValidation,
    ClueDetail,
    ClueEdge,
    ClueImportance,
    ClueNode,
    DetailFillResponse,
    GenerateClueChainRequest,
    GenerateDetailsRequest,
    GenerateNPCsRequest,
    GenerateTruthRequest,
    NPCAssignmentResponse,
    NPCDetail,
    NPCKnowledgeScopePreview,
    NPCSuggestion,
    SelectedTruth,
    StoryDraft,
    StorySettingInput,
    TruthOption,
    TruthOptionsResponse,
)

logger = logging.getLogger(__name__)


class AIStoryAssistantService:
    """AI-powered story creation assistant."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with database session."""
        self.db = db

    # ========== Truth Generation ==========

    async def generate_truth_options(
        self,
        request: GenerateTruthRequest,
    ) -> TruthOptionsResponse:
        """
        Generate multiple truth options based on story setting.

        Args:
            request: Contains story setting and optional hints.

        Returns:
            Multiple truth options for user to choose from.
        """
        config = await self._get_chat_config(request.llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        # Build prompt
        hints_text = ""
        if request.hints:
            if request.hints.murderer_hint:
                hints_text += f"- Murderer hint: {request.hints.murderer_hint}\n"
            if request.hints.motive_hint:
                hints_text += f"- Motive hint: {request.hints.motive_hint}\n"
            if request.hints.method_hint:
                hints_text += f"- Method hint: {request.hints.method_hint}\n"

        system_prompt = """You are an expert mystery story designer. Generate creative and logical murder mystery plots.

Your response must be valid JSON matching this structure:
{
  "options": [
    {
      "murderer": "Who is the murderer (role/identity)",
      "motive": "Why they committed the crime",
      "method": "How they did it (weapon/method)",
      "twist": "Optional surprising twist (can be null)",
      "summary": "Brief 1-2 sentence summary"
    }
  ],
  "recommendation_index": 0,
  "recommendation_reason": "Why this option is recommended"
}

Generate 3 distinct options that:
1. Fit the setting and atmosphere
2. Have logical and believable motives
3. Support interesting investigation gameplay
4. Allow for multiple clue discovery paths"""

        user_prompt = f"""Create 3 murder mystery truth options for this setting:

Genre: {request.setting.genre.value}
Era: {request.setting.era}
Location: {request.setting.location}
Atmosphere: {request.setting.atmosphere or 'Not specified'}
NPC Count: {request.setting.npc_count}
{f'Additional Notes: {request.setting.additional_notes}' if request.setting.additional_notes else ''}

{f'User Hints:\n{hints_text}' if hints_text else ''}

Generate 3 creative and distinct truth options."""

        response = await self._call_llm_json(config, system_prompt, user_prompt)
        return TruthOptionsResponse.model_validate(response)

    # ========== Clue Chain Generation ==========

    async def generate_clue_chain(
        self,
        request: GenerateClueChainRequest,
    ) -> ClueChainSuggestion:
        """
        Generate a clue chain from truth using reverse reasoning.

        The algorithm:
        1. Decompose truth into verifiable sub-conclusions
        2. For each sub-conclusion, determine required evidence
        3. Build dependency graph ensuring no cycles
        4. Add redundant paths for key conclusions

        Args:
            request: Contains setting, truth, and optional existing chain.

        Returns:
            Complete clue chain with validation.
        """
        config = await self._get_chat_config(request.llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        system_prompt = """You are an expert mystery game designer specializing in clue chain design.

Your task is to design a complete clue chain that allows players to discover the truth through logical reasoning.

Your response must be valid JSON matching this structure:
{
  "nodes": [
    {
      "temp_id": "clue_001",
      "name": "Clue name",
      "importance": "high|medium|low",
      "description": "Brief description",
      "reasoning_role": "What this clue proves/suggests",
      "prereq_temp_ids": ["clue_000"],
      "suggested_npc_role": "Who might know this"
    }
  ],
  "reasoning_paths": [["clue_001", "clue_003", "clue_007"]],
  "ai_notes": ["Note about the design"]
}

Design principles:
1. REVERSE REASONING: Start from the truth, work backwards to root clues
2. ROOT CLUES: 3-5 clues with no prerequisites as starting points
3. MULTIPLE PATHS: Key conclusions should be reachable via 2+ paths
4. NO CYCLES: Dependencies must form a DAG (directed acyclic graph)
5. BALANCE: Distribute high-importance clues across the chain
6. TOTAL CLUES: 15-25 clues for a good game experience"""

        user_prompt = f"""Design a clue chain for this murder mystery:

【Story Setting】
Genre: {request.setting.genre.value}
Era: {request.setting.era}
Location: {request.setting.location}

【The Truth】
Murderer: {request.truth.murderer}
Motive: {request.truth.motive}
Method: {request.truth.method}
{f'Twist: {request.truth.twist}' if request.truth.twist else ''}

【Requirements】
- Create 15-25 clues
- At least 3-5 root clues (no prerequisites)
- Key conclusions must have 2+ paths
- Include suggested NPC roles for each clue

Design the complete clue chain now."""

        response = await self._call_llm_json(config, system_prompt, user_prompt)

        # Parse response
        nodes = [ClueNode.model_validate(n) for n in response.get("nodes", [])]
        reasoning_paths = response.get("reasoning_paths", [])
        ai_notes = response.get("ai_notes", [])

        # Build edges from prereq_temp_ids
        edges = []
        for node in nodes:
            for prereq_id in node.prereq_temp_ids:
                edges.append(ClueEdge(source=prereq_id, target=node.temp_id))

        # Validate the chain
        validation = self._validate_clue_chain(nodes, edges)

        return ClueChainSuggestion(
            nodes=nodes,
            edges=edges,
            reasoning_paths=reasoning_paths,
            validation=validation,
            ai_notes=ai_notes,
        )

    def _validate_clue_chain(
        self,
        nodes: list[ClueNode],
        edges: list[ClueEdge],
    ) -> ClueChainValidation:
        """Validate clue chain for logical consistency."""
        node_ids = {n.temp_id for n in nodes}
        warnings = []

        # Build adjacency lists
        forward_adj: dict[str, list[str]] = defaultdict(list)
        reverse_adj: dict[str, list[str]] = defaultdict(list)

        for edge in edges:
            if edge.source in node_ids and edge.target in node_ids:
                forward_adj[edge.source].append(edge.target)
                reverse_adj[edge.target].append(edge.source)

        # Find root clues (no prerequisites)
        root_clues = [n.temp_id for n in nodes if not n.prereq_temp_ids]
        root_count = len(root_clues)

        if root_count < 3:
            warnings.append(f"Only {root_count} root clues - players may struggle to start")
        elif root_count > 8:
            warnings.append(f"{root_count} root clues - may cause information overload")

        # Detect cycles using DFS
        cycles = self._detect_cycles(nodes, forward_adj)
        has_cycles = len(cycles) > 0

        # Find unreachable clues (BFS from roots)
        reachable = set()
        queue = list(root_clues)
        while queue:
            current = queue.pop(0)
            if current in reachable:
                continue
            reachable.add(current)
            queue.extend(forward_adj.get(current, []))

        unreachable = [nid for nid in node_ids if nid not in reachable and nid not in root_clues]

        # Count reasoning paths (simplified - just count paths to high importance clues)
        high_importance_clues = [n for n in nodes if n.importance == ClueImportance.HIGH]
        path_count = 0
        for clue in high_importance_clues:
            paths_to_clue = len(reverse_adj.get(clue.temp_id, [])) or 1
            path_count += paths_to_clue

        return ClueChainValidation(
            is_valid=not has_cycles and len(unreachable) == 0,
            has_cycles=has_cycles,
            cycles=cycles,
            unreachable_clues=unreachable,
            root_clue_count=root_count,
            reasoning_path_count=path_count,
            warnings=warnings,
        )

    def _detect_cycles(
        self,
        nodes: list[ClueNode],
        adj: dict[str, list[str]],
    ) -> list[list[str]]:
        """Detect cycles in the graph using DFS."""
        cycles = []
        visited = set()
        rec_stack = set()
        path = []

        def dfs(node: str) -> None:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for neighbor in adj.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor)
                elif neighbor in rec_stack:
                    # Found cycle
                    cycle_start = path.index(neighbor)
                    cycles.append(path[cycle_start:] + [neighbor])

            path.pop()
            rec_stack.remove(node)

        for node in nodes:
            if node.temp_id not in visited:
                dfs(node.temp_id)

        return cycles

    async def optimize_clue_chain(
        self,
        clue_chain: ClueChainSuggestion,
        focus: str | None = None,
        llm_config_id: str | None = None,
    ) -> ClueChainSuggestion:
        """Optimize an existing clue chain based on validation results."""
        config = await self._get_chat_config(llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        # Serialize current chain
        chain_json = json.dumps(
            {
                "nodes": [n.model_dump() for n in clue_chain.nodes],
                "edges": [e.model_dump() for e in clue_chain.edges],
                "validation": clue_chain.validation.model_dump(),
            },
            ensure_ascii=False,
        )

        system_prompt = """You are an expert at optimizing mystery game clue chains.

Analyze the provided clue chain and its validation results, then suggest improvements.

Your response must be valid JSON with the same structure as the input, but with improvements applied.

Focus on:
1. Fixing any cycles (circular dependencies)
2. Making unreachable clues reachable
3. Adding redundant paths to key conclusions
4. Balancing clue distribution"""

        focus_text = f"Special focus: {focus}" if focus else "General optimization"

        user_prompt = f"""Optimize this clue chain:

{chain_json}

{focus_text}

Return the improved clue chain."""

        response = await self._call_llm_json(config, system_prompt, user_prompt)

        nodes = [ClueNode.model_validate(n) for n in response.get("nodes", [])]
        edges = []
        for node in nodes:
            for prereq_id in node.prereq_temp_ids:
                edges.append(ClueEdge(source=prereq_id, target=node.temp_id))

        validation = self._validate_clue_chain(nodes, edges)

        return ClueChainSuggestion(
            nodes=nodes,
            edges=edges,
            reasoning_paths=response.get("reasoning_paths", []),
            validation=validation,
            ai_notes=response.get("ai_notes", ["Optimized based on validation results"]),
        )

    # ========== NPC Generation ==========

    async def generate_npcs(
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

    # ========== Detail Generation ==========

    async def generate_details(
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

    # ========== Create Script from Draft ==========

    async def create_script_from_draft(
        self,
        draft: StoryDraft,
    ) -> Script:
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

    # ========== LLM Helpers ==========

    async def _get_chat_config(self, config_id: str | None = None) -> LLMConfig | None:
        """Get chat LLM configuration."""
        if config_id:
            result = await self.db.execute(
                select(LLMConfig).where(
                    LLMConfig.id == config_id,
                    LLMConfig.type == LLMConfigType.CHAT,
                    LLMConfig.deleted_at.is_(None),
                )
            )
            config = result.scalar_one_or_none()
            if config:
                return config

        # Try to get default chat config first
        result = await self.db.execute(
            select(LLMConfig).where(
                LLMConfig.type == LLMConfigType.CHAT,
                LLMConfig.is_default.is_(True),
                LLMConfig.deleted_at.is_(None),
            )
        )
        config = result.scalar_one_or_none()
        if config:
            return config

        # Fallback: get any available chat config
        result = await self.db.execute(
            select(LLMConfig).where(
                LLMConfig.type == LLMConfigType.CHAT,
                LLMConfig.deleted_at.is_(None),
            ).limit(1)
        )
        return result.scalar_one_or_none()

    async def _call_llm_json(
        self,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
    ) -> dict:
        """Call LLM and parse JSON response."""
        async with httpx.AsyncClient(timeout=settings.llm_long_timeout) as client:
            response = await client.post(
                f"{config.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json={
                    "model": config.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
