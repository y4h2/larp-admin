import client from './client';

export interface PolishClueRequest {
  clue_name: string;
  clue_detail: string;
  context?: string;
  llm_config_id?: string;
}

export interface PolishClueResponse {
  polished_detail: string;
}

export interface SuggestKeywordsRequest {
  clue_name: string;
  clue_detail: string;
  existing_keywords?: string[];
  llm_config_id?: string;
}

export interface SuggestKeywordsResponse {
  keywords: string[];
}

export interface GenerateSemanticSummaryRequest {
  clue_name: string;
  clue_detail: string;
  llm_config_id?: string;
}

export interface GenerateSemanticSummaryResponse {
  semantic_summary: string;
}

export interface PolishNPCRequest {
  npc_name: string;
  field: 'background' | 'personality' | 'system_prompt';
  content: string;
  context?: string;
  llm_config_id?: string;
}

export interface PolishNPCResponse {
  polished_content: string;
}

export interface ClueInfo {
  id: string;
  name: string;
  detail?: string;
  prereq_clue_ids?: string[];
}

export interface AnalyzeClueChainRequest {
  clues: ClueInfo[];
  script_background?: string;
  llm_config_id?: string;
}

export interface ClueChainIssue {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  affected_clues: string[];
}

export interface ClueChainSuggestion {
  type: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AnalyzeClueChainResponse {
  overall_score: number;
  summary: string;
  issues: ClueChainIssue[];
  suggestions: ClueChainSuggestion[];
  key_clues: string[];
  reasoning_paths: string[];
}

export const aiEnhancementApi = {
  polishClue: async (request: PolishClueRequest): Promise<PolishClueResponse> => {
    const response = await client.post('/ai-enhance/polish-clue', request);
    return response.data;
  },

  suggestKeywords: async (request: SuggestKeywordsRequest): Promise<SuggestKeywordsResponse> => {
    const response = await client.post('/ai-enhance/suggest-keywords', request);
    return response.data;
  },

  generateSemanticSummary: async (request: GenerateSemanticSummaryRequest): Promise<GenerateSemanticSummaryResponse> => {
    const response = await client.post('/ai-enhance/generate-semantic-summary', request);
    return response.data;
  },

  polishNPC: async (request: PolishNPCRequest): Promise<PolishNPCResponse> => {
    const response = await client.post('/ai-enhance/polish-npc', request);
    return response.data;
  },

  analyzeClueChain: async (request: AnalyzeClueChainRequest): Promise<AnalyzeClueChainResponse> => {
    const response = await client.post('/ai-enhance/analyze-clue-chain', request);
    return response.data;
  },
};
