// Script types
export interface Script {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'test' | 'online' | 'archived';
  version: number;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export interface Scene {
  id: string;
  script_id: string;
  name: string;
  description: string;
  sort_order: number;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

// NPC types
export interface NPC {
  id: string;
  script_id: string;
  scene_id?: string | null;
  name: string;
  name_en: string | null;
  age: number | null;
  job: string | null;
  role_type: 'suspect' | 'witness' | 'other';
  personality: string;
  speech_style: string;
  background_story: string;
  relations: Record<string, unknown>;
  system_prompt_template: string;
  extra_prompt_vars: Record<string, unknown>;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

// Clue types
export interface KeywordCondition {
  keywords: string[];
  logic: 'AND' | 'OR';
  requirement: 'must' | 'should';
}

export interface SemanticCondition {
  target_queries: string[];
  similarity_threshold: number;
  context_window?: number;
}

export interface StateCondition {
  prerequisite_clue_ids: string[];
  player_state_requirements: Record<string, unknown>;
  stage_lock?: number;
}

export interface TextConditions {
  keyword_lists: KeywordCondition[];
  blacklist: string[];
}

export interface UnlockConditions {
  text_conditions: TextConditions;
  semantic_conditions: SemanticCondition | null;
  state_conditions: StateCondition | null;
}

export interface ClueEffects {
  display_text: string;
  game_state_updates: Record<string, unknown>;
  one_time_trigger: boolean;
}

export interface Clue {
  id: string;
  script_id: string;
  scene_id: string | null;
  title_internal: string;
  title_player: string;
  content_text: string;
  content_type: 'text' | 'image' | 'structured';
  content_payload: Record<string, unknown>;
  clue_type: 'evidence' | 'testimony' | 'world_info' | 'decoy';
  importance: 'critical' | 'major' | 'minor' | 'easter_egg';
  stage: number;
  npc_ids: string[];
  status: 'draft' | 'active' | 'disabled';
  unlock_conditions: UnlockConditions;
  effects: ClueEffects;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  version: number;
}

export interface ClueVersion {
  id: string;
  clue_id: string;
  version: number;
  data: Clue;
  created_by: string;
  created_at: string;
}

// Algorithm types
export interface AlgorithmImplementation {
  id: string;
  name: string;
  description: string;
  param_schema: Record<string, unknown>;
  status: 'active' | 'deprecated';
}

export interface AlgorithmStrategy {
  id: string;
  name: string;
  description: string;
  impl_id: string;
  scope_type: 'global' | 'script' | 'scene' | 'npc';
  scope_target_id: string | null;
  params: Record<string, unknown>;
  status: 'draft' | 'published' | 'deprecated';
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Experiment types
export interface DialogueLog {
  id: string;
  session_id: string;
  script_id: string;
  scene_id: string;
  npc_id: string;
  player_message: string;
  npc_response: string;
  matched_clues: MatchedClue[];
  strategy_id: string;
  created_at: string;
}

export interface MatchedClue {
  clue_id: string;
  score: number;
  match_type: 'keyword' | 'semantic' | 'hybrid';
  keyword_matches?: string[];
  embedding_similarity?: number;
}

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  strategy_a_id: string;
  strategy_b_id: string;
  traffic_split: number;
  status: 'draft' | 'running' | 'completed';
  start_at: string | null;
  end_at: string | null;
  created_at: string;
}

// Simulation types
export interface SimulationRequest {
  script_id: string;
  scene_id: string;
  npc_id: string;
  strategy_id: string;
  unlocked_clue_ids: string[];
  player_message: string;
}

export interface SimulationResult {
  matched_clues: MatchedClue[];
  final_clue_list: Clue[];
  debug_info: {
    keyword_matches: Record<string, string[]>;
    embedding_similarities: Record<string, number>;
    total_processing_time_ms: number;
  };
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

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  changes: Record<string, unknown>;
  created_at: string;
}

export interface GlobalSettings {
  default_strategy_id: string | null;
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
