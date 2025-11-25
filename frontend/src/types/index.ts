// Script types based on data/sample/clue.py
export interface Truth {
  murderer?: string;
  weapon?: string;
  motive?: string;
  crime_method?: string;
}

export interface Script {
  id: string;
  title: string;
  summary?: string;
  background?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  truth: Truth;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// NPC types based on data/sample/clue.py
export interface KnowledgeScope {
  knows: string[];
  does_not_know: string[];
  world_model_limits: string[];
}

export interface NPC {
  id: string;
  script_id: string;
  name: string;
  age: number | null;
  background: string | null;
  personality: string | null;
  knowledge_scope: KnowledgeScope;
  created_at: string;
  updated_at: string;
}

// Clue types based on data/sample/clue.py
export interface Clue {
  id: string;
  script_id: string;
  npc_id: string;
  name: string;
  type: 'text' | 'image';
  detail: string;
  detail_for_npc: string;
  trigger_keywords: string[];
  trigger_semantic_summary: string;
  prereq_clue_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ClueTreeNode {
  id: string;
  name: string;
  type: string;
  npc_id: string;
  prereq_clue_ids: string[];
}

export interface ClueTreeEdge {
  source: string;
  target: string;
}

export interface ClueTreeResponse {
  nodes: ClueTreeNode[];
  edges: ClueTreeEdge[];
}

// Simulation types
export type MatchingStrategy = 'keyword' | 'embedding' | 'llm';

export interface MatchedClue {
  clue_id: string;
  name: string;
  clue_type: string;
  score: number;
  match_reasons: string[];
  keyword_matches: string[];
  embedding_similarity?: number | null;
  is_triggered: boolean;
}

export interface SimulationRequest {
  script_id: string;
  npc_id: string;
  unlocked_clue_ids: string[];
  player_message: string;
  matching_strategy?: MatchingStrategy;
  template_id?: string;
  llm_config_id?: string;
  // NPC reply configuration
  npc_reply_template_id?: string;
  npc_chat_config_id?: string;
  // Session tracking
  session_id?: string;
  save_log?: boolean;
}

export interface SimulationResult {
  matched_clues: MatchedClue[];
  triggered_clues: MatchedClue[];
  npc_response?: string | null;
  debug_info: {
    total_candidates: number;
    total_matched: number;
    total_triggered: number;
    threshold: number;
    strategy: MatchingStrategy;
  };
  log_id?: string | null;
}

// Dialogue Log types
export interface DialogueLog {
  id: string;
  session_id: string;
  script_id: string;
  npc_id: string;
  player_message: string;
  npc_response: string;
  matched_clues: MatchedClue[];
  created_at: string;
}

// Debug Audit Log types
export interface DebugAuditLog {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  context: Record<string, unknown>;
  request_id?: string;
  user_id?: string;
  created_at: string;
}

// System types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'inactive';
  created_at: string;
}

export interface GlobalSettings {
  default_embedding_model: string;
  default_similarity_threshold: number;
}

// API response types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
