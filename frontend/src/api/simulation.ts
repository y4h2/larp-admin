import client from './client';
import type { DialogueLog, SimulationRequest, SimulationResult, PaginatedResponse } from '@/types';

export interface LogQueryParams {
  page?: number;
  page_size?: number;
  script_id?: string;
  npc_id?: string;
  session_id?: string;
  start_date?: string;
  end_date?: string;
}

// Simulation API
export const simulationApi = {
  run: async (request: SimulationRequest): Promise<SimulationResult> => {
    const response = await client.post('/simulate', request);
    return response.data;
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
