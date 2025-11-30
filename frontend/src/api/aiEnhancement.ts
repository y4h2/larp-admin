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

// Streaming callback types
export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullContent: string) => void;
  onError: (error: Error) => void;
}

// Helper function to handle SSE streaming
async function handleSSEStream(
  url: string,
  request: unknown,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem('auth_token');

  const response = await fetch(`/api${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            callbacks.onComplete(fullContent);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              callbacks.onError(new Error(parsed.error));
              return;
            }
            if (parsed.chunk) {
              fullContent += parsed.chunk;
              callbacks.onChunk(parsed.chunk);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
    // Handle any remaining content
    callbacks.onComplete(fullContent);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Request was cancelled, don't call onError
      return;
    }
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export const aiEnhancementApi = {
  polishClue: async (request: PolishClueRequest): Promise<PolishClueResponse> => {
    const response = await client.post('/ai-enhance/polish-clue', request);
    return response.data;
  },

  polishClueStream: async (
    request: PolishClueRequest,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> => {
    return handleSSEStream('/ai-enhance/polish-clue/stream', request, callbacks, signal);
  },

  suggestKeywords: async (request: SuggestKeywordsRequest): Promise<SuggestKeywordsResponse> => {
    const response = await client.post('/ai-enhance/suggest-keywords', request);
    return response.data;
  },

  generateSemanticSummary: async (request: GenerateSemanticSummaryRequest): Promise<GenerateSemanticSummaryResponse> => {
    const response = await client.post('/ai-enhance/generate-semantic-summary', request);
    return response.data;
  },

  generateSemanticSummaryStream: async (
    request: GenerateSemanticSummaryRequest,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> => {
    return handleSSEStream('/ai-enhance/generate-semantic-summary/stream', request, callbacks, signal);
  },

  polishNPC: async (request: PolishNPCRequest): Promise<PolishNPCResponse> => {
    const response = await client.post('/ai-enhance/polish-npc', request);
    return response.data;
  },

  polishNPCStream: async (
    request: PolishNPCRequest,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> => {
    return handleSSEStream('/ai-enhance/polish-npc/stream', request, callbacks, signal);
  },

  analyzeClueChain: async (request: AnalyzeClueChainRequest): Promise<AnalyzeClueChainResponse> => {
    const response = await client.post('/ai-enhance/analyze-clue-chain', request);
    return response.data;
  },
};
