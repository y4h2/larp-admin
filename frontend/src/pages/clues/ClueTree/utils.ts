import type { SavedPositions } from './types';
import { POSITIONS_STORAGE_KEY } from './constants';

// Load saved positions from localStorage
export function loadSavedPositions(): SavedPositions {
  try {
    const saved = localStorage.getItem(POSITIONS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// Save positions to localStorage
export function savePositionsToStorage(positions: SavedPositions): void {
  try {
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage errors
  }
}

// Helper to format date for display
export function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Helper function to detect cycles
export function detectCycle(
  edges: Array<{ source: string; target: string }>,
  newSource: string,
  newTarget: string
): boolean {
  const adjacency = new Map<string, string[]>();

  edges.forEach((edge) => {
    const children = adjacency.get(edge.source) || [];
    children.push(edge.target);
    adjacency.set(edge.source, children);
  });

  const children = adjacency.get(newSource) || [];
  children.push(newTarget);
  adjacency.set(newSource, children);

  const visited = new Set<string>();
  const stack = [newTarget];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === newSource) {
      return true;
    }
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = adjacency.get(current) || [];
    stack.push(...neighbors);
  }

  return false;
}

// Get all descendants of a node
export function getDescendants(
  nodeId: string,
  edges: Array<{ source: string; target: string }>
): Set<string> {
  const descendants = new Set<string>();
  const adjacency = new Map<string, string[]>();

  // Build adjacency list (parent -> children)
  edges.forEach((edge) => {
    const children = adjacency.get(edge.source) || [];
    children.push(edge.target);
    adjacency.set(edge.source, children);
  });

  // BFS to find all descendants
  const queue = adjacency.get(nodeId) || [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!descendants.has(current)) {
      descendants.add(current);
      const children = adjacency.get(current) || [];
      queue.push(...children);
    }
  }

  return descendants;
}
