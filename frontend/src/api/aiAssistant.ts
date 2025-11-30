/**
 * AI Story Creation Assistant API
 */

import client from './client';

// ========== Enums ==========

export type StoryGenre = 'murder_mystery' | 'thriller' | 'wuxia' | 'modern' | 'historical' | 'fantasy';
export type ClueImportance = 'high' | 'medium' | 'low';
export type GenerationStep = 'setting' | 'truth' | 'clue_chain' | 'npc_assignment' | 'detail_fill' | 'review';

// ========== Types ==========

export interface StorySettingInput {
  genre: StoryGenre;
  era: string;
  location: string;
  atmosphere?: string;
  npc_count: number;
  additional_notes?: string;
}

export interface TruthInput {
  murderer_hint?: string;
  motive_hint?: string;
  method_hint?: string;
  auto_generate?: boolean;
}

export interface TruthOption {
  murderer: string;
  motive: string;
  method: string;
  twist?: string;
  summary: string;
}

export interface TruthOptionsResponse {
  options: TruthOption[];
  recommendation_index: number;
  recommendation_reason?: string;
}

export interface SelectedTruth {
  murderer: string;
  motive: string;
  method: string;
  twist?: string;
}

export interface ClueNode {
  temp_id: string;
  name: string;
  importance: ClueImportance;
  description: string;
  reasoning_role: string;
  prereq_temp_ids: string[];
  suggested_npc_role?: string;
}

export interface ClueEdge {
  source: string;
  target: string;
}

export interface ClueChainValidation {
  is_valid: boolean;
  has_cycles: boolean;
  cycles: string[][];
  unreachable_clues: string[];
  root_clue_count: number;
  reasoning_path_count: number;
  warnings: string[];
}

export interface ClueChainSuggestion {
  nodes: ClueNode[];
  edges: ClueEdge[];
  reasoning_paths: string[][];
  validation: ClueChainValidation;
  ai_notes: string[];
}

export interface NPCKnowledgeScopePreview {
  knows: string[];
  does_not_know: string[];
  world_model_limits: string[];
}

export interface NPCSuggestion {
  temp_id: string;
  name: string;
  role: string;
  age?: number;
  background_summary: string;
  personality_traits: string[];
  assigned_clue_temp_ids: string[];
  knowledge_scope_preview: NPCKnowledgeScopePreview;
}

export interface NPCAssignmentResponse {
  npcs: NPCSuggestion[];
  unassigned_clue_temp_ids: string[];
  ai_notes: string[];
}

export interface ClueDetail {
  temp_id: string;
  name: string;
  detail: string;
  detail_for_npc: string;
  trigger_keywords: string[];
  trigger_semantic_summary: string;
}

export interface NPCDetail {
  temp_id: string;
  name: string;
  age?: number;
  background: string;
  personality: string;
  knowledge_scope: NPCKnowledgeScopePreview;
}

export interface DetailFillResponse {
  clue_details: ClueDetail[];
  npc_details: NPCDetail[];
  progress: number;
}

export interface StoryDraft {
  title: string;
  summary: string;
  background: string;
  difficulty: string;
  truth: Record<string, unknown>;
  clue_chain: ClueChainSuggestion;
  npcs: NPCSuggestion[];
  clue_details: ClueDetail[];
  npc_details: NPCDetail[];
  validation_result: ClueChainValidation;
  ready_to_create: boolean;
}

// ========== Request Types ==========

export interface GenerateTruthRequest {
  setting: StorySettingInput;
  hints?: TruthInput;
  llm_config_id?: string;
}

export interface GenerateClueChainRequest {
  setting: StorySettingInput;
  truth: SelectedTruth;
  existing_chain?: ClueChainSuggestion;
  llm_config_id?: string;
}

export interface GenerateNPCsRequest {
  setting: StorySettingInput;
  truth: SelectedTruth;
  clue_chain: ClueChainSuggestion;
  npc_count: number;
  llm_config_id?: string;
}

export interface GenerateDetailsRequest {
  setting: StorySettingInput;
  truth: SelectedTruth;
  clue_chain: ClueChainSuggestion;
  npcs: NPCSuggestion[];
  clue_temp_ids?: string[];
  llm_config_id?: string;
}

export interface OptimizeClueChainRequest {
  clue_chain: ClueChainSuggestion;
  focus?: string;
  llm_config_id?: string;
}

export interface CreateScriptResponse {
  script_id: string;
  title: string;
  message: string;
}

// ========== API Functions ==========

export const aiAssistantApi = {
  /**
   * Generate truth options based on story setting
   */
  generateTruth: async (request: GenerateTruthRequest): Promise<TruthOptionsResponse> => {
    const response = await client.post<TruthOptionsResponse>('/ai-assistant/generate-truth', request);
    return response.data;
  },

  /**
   * Generate clue chain from selected truth
   */
  generateClueChain: async (request: GenerateClueChainRequest): Promise<ClueChainSuggestion> => {
    const response = await client.post<ClueChainSuggestion>('/ai-assistant/generate-clue-chain', request);
    return response.data;
  },

  /**
   * Optimize existing clue chain
   */
  optimizeClueChain: async (request: OptimizeClueChainRequest): Promise<ClueChainSuggestion> => {
    const response = await client.post<ClueChainSuggestion>('/ai-assistant/optimize-clue-chain', request);
    return response.data;
  },

  /**
   * Generate NPCs and assign clues
   */
  generateNPCs: async (request: GenerateNPCsRequest): Promise<NPCAssignmentResponse> => {
    const response = await client.post<NPCAssignmentResponse>('/ai-assistant/generate-npcs', request);
    return response.data;
  },

  /**
   * Generate detailed content for clues and NPCs
   */
  generateDetails: async (request: GenerateDetailsRequest): Promise<DetailFillResponse> => {
    const response = await client.post<DetailFillResponse>('/ai-assistant/generate-details', request);
    return response.data;
  },

  /**
   * Create actual script from draft
   */
  createScript: async (draft: StoryDraft): Promise<CreateScriptResponse> => {
    const response = await client.post<CreateScriptResponse>('/ai-assistant/create-script', { draft });
    return response.data;
  },

  /**
   * Validate clue chain structure (no LLM)
   */
  validateClueChain: async (clueChain: ClueChainSuggestion): Promise<ClueChainValidation> => {
    const response = await client.post<ClueChainValidation>('/ai-assistant/validate-clue-chain', clueChain);
    return response.data;
  },
};

export default aiAssistantApi;
