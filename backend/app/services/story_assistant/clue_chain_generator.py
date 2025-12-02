"""Clue chain generation with validation and optimization."""

import json
import logging
from collections import defaultdict

from app.schemas.ai_assistant import (
    ClueChainSuggestion,
    ClueChainValidation,
    ClueEdge,
    ClueImportance,
    ClueNode,
    GenerateClueChainRequest,
)

from .llm_base import LLMBase

logger = logging.getLogger(__name__)


class ClueChainGenerator(LLMBase):
    """Generates and validates clue chains using reverse reasoning."""

    async def generate(
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
        validation = ClueChainGenerator.validate(nodes, edges)

        return ClueChainSuggestion(
            nodes=nodes,
            edges=edges,
            reasoning_paths=reasoning_paths,
            validation=validation,
            ai_notes=ai_notes,
        )

    async def optimize(
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

        validation = ClueChainGenerator.validate(nodes, edges)

        return ClueChainSuggestion(
            nodes=nodes,
            edges=edges,
            reasoning_paths=response.get("reasoning_paths", []),
            validation=validation,
            ai_notes=response.get("ai_notes", ["Optimized based on validation results"]),
        )

    @staticmethod
    def validate(
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
        cycles = ClueChainGenerator._detect_cycles(nodes, forward_adj)
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

        # Count reasoning paths (simplified)
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

    @staticmethod
    def _detect_cycles(
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
