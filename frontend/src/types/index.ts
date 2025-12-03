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

export interface EmbeddingOptionsOverride {
  similarity_threshold?: number;
}

export interface ChatOptionsOverride {
  temperature?: number;
  max_tokens?: number;
}

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
  npc_clue_template_id?: string;  // Template when clues triggered
  npc_no_clue_template_id?: string;  // Template when no clues triggered
  npc_chat_config_id?: string;
  // Session tracking
  session_id?: string;
  username?: string;
  save_log?: boolean;
  // Runtime options override (for debugging/testing)
  embedding_options_override?: EmbeddingOptionsOverride;
  chat_options_override?: ChatOptionsOverride;
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
export interface DialogueLogContext {
  unlocked_clue_ids: string[];
  matching_strategy: string;
  template_id?: string | null;
  llm_config_id?: string | null;
  npc_clue_template_id?: string | null;
  npc_no_clue_template_id?: string | null;
  npc_chat_config_id?: string | null;
}

// 提示词分段信息 - 用于颜色区分显示
export interface PromptSegment {
  type: 'system' | 'template' | 'variable';  // 来源类型
  content: string;                           // 内容
  variable_name?: string;                    // 如果是变量，变量名
}

export interface CandidateClueDetail {
  clue_id: string;
  name: string;
  trigger_keywords: string[];
  trigger_semantic_summary: string;
  match_prompt?: string;  // LLM 策略使用的匹配提示词 (legacy)
  llm_system_prompt?: string;  // LLM 匹配时的 system prompt
  llm_user_message?: string;   // LLM 匹配时的 user message
  llm_system_prompt_segments?: PromptSegment[];  // 分段的 system prompt
  llm_user_message_segments?: PromptSegment[];   // 分段的 user message
  embedding_rendered_content?: string;  // embedding 策略使用的渲染内容
  embedding_rendered_segments?: PromptSegment[];  // embedding 策略使用的渲染分段 - 用于颜色区分显示
}

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PromptInfo {
  system_prompt?: string | null;
  user_prompt?: string | null;
  messages?: PromptMessage[] | null;
  has_clue?: boolean;  // Whether triggered clues were used in the prompt
  system_prompt_segments?: PromptSegment[] | null;
  user_prompt_segments?: PromptSegment[] | null;
}

export interface DialogueLogDebugInfo {
  total_clues?: number;
  total_candidates?: number;
  total_excluded?: number;
  total_matched?: number;
  total_triggered?: number;
  threshold?: number;
  strategy?: string;
  candidates?: CandidateClueDetail[];
  excluded?: string[];
  prompt_info?: PromptInfo | null;
}

export interface DialogueLog {
  id: string;
  session_id: string;
  username?: string | null;
  script_id: string;
  npc_id: string;
  player_message: string;
  npc_response: string;
  context: DialogueLogContext;
  matched_clues: MatchedClue[];
  triggered_clues: string[];
  debug_info: DialogueLogDebugInfo;
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
