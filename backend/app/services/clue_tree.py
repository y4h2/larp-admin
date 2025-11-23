"""Clue tree validation and traversal service."""

from collections import defaultdict
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clue import Clue, ClueRelation
from app.schemas.clue import (
    ClueRelationResponse,
    ClueTreeNode,
    ClueTreeResponse,
    ClueTreeValidation,
)


@dataclass
class ClueGraph:
    """Internal representation of clue dependency graph."""

    nodes: dict[str, Clue] = field(default_factory=dict)
    edges: list[ClueRelation] = field(default_factory=list)
    adjacency: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    reverse_adjacency: dict[str, list[str]] = field(
        default_factory=lambda: defaultdict(list)
    )

    def add_node(self, clue: Clue) -> None:
        """Add a clue node to the graph."""
        self.nodes[clue.id] = clue

    def add_edge(self, relation: ClueRelation) -> None:
        """Add a relation edge to the graph."""
        self.edges.append(relation)
        self.adjacency[relation.prerequisite_clue_id].append(relation.dependent_clue_id)
        self.reverse_adjacency[relation.dependent_clue_id].append(
            relation.prerequisite_clue_id
        )


class ClueTreeService:
    """
    Service for clue tree operations including validation and traversal.

    Provides functionality to:
    - Build and return clue tree structure
    - Detect cycles in the dependency graph
    - Find dead clues (unreachable from starting points)
    - Find orphan clues (no relations)
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the service with a database session."""
        self.db = db

    async def get_clue_tree(self, script_id: str) -> ClueTreeResponse:
        """
        Get the clue tree structure for a script.

        Args:
            script_id: The script ID to get the tree for.

        Returns:
            ClueTreeResponse containing nodes and edges.
        """
        graph = await self._build_graph(script_id)

        nodes = []
        for clue_id, clue in graph.nodes.items():
            prerequisites = graph.reverse_adjacency.get(clue_id, [])
            dependents = graph.adjacency.get(clue_id, [])

            node = ClueTreeNode(
                id=clue.id,
                title_internal=clue.title_internal,
                title_player=clue.title_player,
                clue_type=clue.clue_type.value,
                importance=clue.importance.value,
                stage=clue.stage,
                status=clue.status.value,
                prerequisite_count=len(prerequisites),
                dependent_count=len(dependents),
                prerequisites=prerequisites,
                dependents=dependents,
            )
            nodes.append(node)

        edges = [
            ClueRelationResponse(
                id=edge.id,
                prerequisite_clue_id=edge.prerequisite_clue_id,
                dependent_clue_id=edge.dependent_clue_id,
                relation_type=edge.relation_type.value,
            )
            for edge in graph.edges
        ]

        return ClueTreeResponse(nodes=nodes, edges=edges)

    async def validate_clue_tree(self, script_id: str) -> ClueTreeValidation:
        """
        Validate the clue tree for a script.

        Checks for:
        - Cycles in the dependency graph
        - Dead clues (unreachable from any starting point)
        - Orphan clues (no prerequisites and not referenced by others)

        Args:
            script_id: The script ID to validate.

        Returns:
            ClueTreeValidation with validation results.
        """
        graph = await self._build_graph(script_id)

        # Detect cycles using DFS
        cycles = self._detect_cycles(graph)

        # Find root clues (no prerequisites)
        root_clues = self._find_root_clues(graph)

        # Find dead clues (unreachable from roots)
        dead_clues = self._find_dead_clues(graph, root_clues)

        # Find orphan clues (no relations at all)
        orphan_clues = self._find_orphan_clues(graph)

        warnings = []
        if not root_clues:
            warnings.append("No root clues found (all clues have prerequisites)")
        if len(root_clues) > 10:
            warnings.append(
                f"Large number of root clues ({len(root_clues)}), consider consolidating"
            )

        is_valid = len(cycles) == 0 and len(dead_clues) == 0

        return ClueTreeValidation(
            is_valid=is_valid,
            cycles=cycles,
            dead_clues=dead_clues,
            orphan_clues=orphan_clues,
            warnings=warnings,
        )

    async def _build_graph(self, script_id: str) -> ClueGraph:
        """Build the clue graph for a script."""
        graph = ClueGraph()

        # Fetch all clues for the script
        clues_result = await self.db.execute(
            select(Clue).where(Clue.script_id == script_id)
        )
        clues = clues_result.scalars().all()

        for clue in clues:
            graph.add_node(clue)

        # Fetch all relations for clues in this script
        clue_ids = [clue.id for clue in clues]
        if clue_ids:
            relations_result = await self.db.execute(
                select(ClueRelation).where(
                    ClueRelation.prerequisite_clue_id.in_(clue_ids)
                )
            )
            relations = relations_result.scalars().all()

            for relation in relations:
                graph.add_edge(relation)

        return graph

    def _detect_cycles(self, graph: ClueGraph) -> list[list[str]]:
        """
        Detect cycles in the graph using DFS.

        Returns a list of cycles, where each cycle is a list of clue IDs.
        """
        cycles: list[list[str]] = []
        visited: set[str] = set()
        rec_stack: set[str] = set()
        path: list[str] = []

        def dfs(node: str) -> None:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for neighbor in graph.adjacency.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor)
                elif neighbor in rec_stack:
                    # Found a cycle
                    cycle_start = path.index(neighbor)
                    cycle = path[cycle_start:] + [neighbor]
                    cycles.append(cycle)

            path.pop()
            rec_stack.remove(node)

        for node in graph.nodes:
            if node not in visited:
                dfs(node)

        return cycles

    def _find_root_clues(self, graph: ClueGraph) -> set[str]:
        """Find clues with no prerequisites (root nodes)."""
        roots = set()
        for clue_id in graph.nodes:
            if not graph.reverse_adjacency.get(clue_id):
                roots.add(clue_id)
        return roots

    def _find_dead_clues(self, graph: ClueGraph, root_clues: set[str]) -> list[str]:
        """
        Find clues that are unreachable from any root clue.

        A dead clue has prerequisites but those prerequisites form an
        unreachable subgraph.
        """
        if not root_clues:
            # If no roots, all non-orphan clues are potentially dead
            return [
                clue_id
                for clue_id in graph.nodes
                if graph.reverse_adjacency.get(clue_id)
            ]

        # BFS from all root clues
        reachable: set[str] = set()
        queue = list(root_clues)

        while queue:
            current = queue.pop(0)
            if current in reachable:
                continue
            reachable.add(current)

            for neighbor in graph.adjacency.get(current, []):
                if neighbor not in reachable:
                    queue.append(neighbor)

        # Dead clues are non-root clues that are not reachable
        dead = []
        for clue_id in graph.nodes:
            if clue_id not in root_clues and clue_id not in reachable:
                dead.append(clue_id)

        return dead

    def _find_orphan_clues(self, graph: ClueGraph) -> list[str]:
        """Find clues with no relations (neither prerequisites nor dependents)."""
        orphans = []
        for clue_id in graph.nodes:
            has_prerequisites = bool(graph.reverse_adjacency.get(clue_id))
            has_dependents = bool(graph.adjacency.get(clue_id))
            if not has_prerequisites and not has_dependents:
                orphans.append(clue_id)
        return orphans
