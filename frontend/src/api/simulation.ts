import client from './client';
import type { DialogueLog, SimulationRequest, SimulationResult, PaginatedResponse, MatchedClue, DialogueLogDebugInfo } from '@/types';

export interface LogQueryParams {
  page?: number;
  page_size?: number;
  script_id?: string;
  npc_id?: string;
  session_id?: string;
  start_date?: string;
  end_date?: string;
}

// Streaming types
export interface StreamMatchResult {
  matched_clues: MatchedClue[];
  triggered_clues: MatchedClue[];
  debug_info: DialogueLogDebugInfo;
  matching_llm_usage?: {
    matching_tokens?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    matching_latency_ms?: number;
    matching_model?: string;
  };
}

export interface StreamCompleteData {
  npc_response: string | null;
  prompt_info: {
    system_prompt?: string;
    user_prompt?: string;
    messages?: { role: string; content: string }[];
    has_clue?: boolean;
    system_prompt_segments?: { type: string; content: string; variable_name?: string }[];
    user_prompt_segments?: { type: string; content: string; variable_name?: string }[];
  } | null;
  npc_llm_usage?: {
    npc_tokens?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    npc_latency_ms?: number;
    npc_model?: string;
  } | null;
  log_id: string | null;
}

export interface StreamEventHandlers {
  onMatchResult?: (data: StreamMatchResult) => void;
  onNpcChunk?: (chunk: string) => void;
  onComplete?: (data: StreamCompleteData) => void;
  onError?: (error: { error: string; code: string }) => void;
}

// Simulation API
export const simulationApi = {
  run: async (request: SimulationRequest): Promise<SimulationResult> => {
    const response = await client.post('/simulate', request);
    return response.data;
  },

  runStream: async (
    request: SimulationRequest,
    handlers: StreamEventHandlers,
    signal?: AbortSignal,
  ): Promise<void> => {
    const token = localStorage.getItem('auth_token');

    const response = await fetch('/api/simulate/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      let currentEvent = '';

      const processLines = (lines: string[]) => {
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);

            if (currentEvent && dataStr) {
              try {
                const data = JSON.parse(dataStr);
                switch (currentEvent) {
                  case 'match_result':
                    handlers.onMatchResult?.(data);
                    break;
                  case 'npc_chunk':
                    handlers.onNpcChunk?.(data.chunk);
                    break;
                  case 'complete':
                    handlers.onComplete?.(data);
                    break;
                  case 'error':
                    handlers.onError?.(data);
                    break;
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
            currentEvent = '';
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining data in buffer when stream ends
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            processLines(lines);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        processLines(lines);
      }
    } finally {
      reader.releaseLock();
    }
  },

  debugClue: async (clueId: string, playerMessage: string): Promise<{
    keyword_match: boolean;
    keyword_details: Record<string, boolean>;
    semantic_match: boolean;
    semantic_score: number;
    state_match: boolean;
    state_details: Record<string, boolean>;
    final_result: boolean;
  }> => {
    const response = await client.post('/debug/clue', {
      clue_id: clueId,
      player_message: playerMessage,
    });
    return response.data;
  },
};

// Dialogue Logs API
export const logApi = {
  list: async (params: LogQueryParams = {}): Promise<PaginatedResponse<DialogueLog>> => {
    const response = await client.get('/logs', { params });
    return response.data;
  },

  get: async (id: string): Promise<DialogueLog> => {
    const response = await client.get(`/logs/${id}`);
    return response.data;
  },

  getSession: async (sessionId: string): Promise<DialogueLog[]> => {
    const response = await client.get(`/logs/session/${sessionId}`);
    return response.data;
  },
};
