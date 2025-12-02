import type { ClueTreeNode } from '@/api/clues';

// Available fields that can be shown on clue nodes
export type ClueNodeField =
  | 'name'
  | 'type'
  | 'detail'
  | 'npc_id'
  | 'prereq_clue_ids'
  | 'trigger_keywords'
  | 'created_at'
  | 'updated_at';

export interface SavedPositions {
  [scriptId: string]: {
    [nodeId: string]: { x: number; y: number };
  };
}

export interface ClueNodeData {
  clue: ClueTreeNode;
  onClick: (clueId: string) => void;
  onToggleCollapse: (clueId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  visibleFields: ClueNodeField[];
  npcMap: Map<string, string>;
  isCollapsed: boolean;
  hasChildren: boolean;
  hiddenChildCount: number;
  incomingEdgeCount: number;
  incomingSourceNames: string[];
  isHovered: boolean;
}

export interface ClickableEdgeData extends Record<string, unknown> {
  onDelete?: (source: string, target: string) => void;
  edgeIndex?: number;
  totalEdgesToTarget?: number;
  isHighlighted?: boolean;
  sourceName?: string;
}

export interface ClueFieldConfig {
  field: ClueNodeField;
  labelKey: string;
}
