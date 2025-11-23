import client from './client';
import type { DialogueLog, ABTestConfig, SimulationRequest, SimulationResult, PaginatedResponse } from '@/types';

export interface LogQueryParams {
  page?: number;
  page_size?: number;
  script_id?: string;
  scene_id?: string;
  npc_id?: string;
  session_id?: string;
  start_date?: string;
  end_date?: string;
}

export interface ABTestQueryParams {
  page?: number;
  page_size?: number;
  status?: ABTestConfig['status'];
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

// A/B Test Config API
export const abTestApi = {
  list: async (params: ABTestQueryParams = {}): Promise<PaginatedResponse<ABTestConfig>> => {
    const response = await client.get('/ab-tests', { params });
    return response.data;
  },

  get: async (id: string): Promise<ABTestConfig> => {
    const response = await client.get(`/ab-tests/${id}`);
    return response.data;
  },

  create: async (data: Partial<ABTestConfig>): Promise<ABTestConfig> => {
    const response = await client.post('/ab-tests', data);
    return response.data;
  },

  update: async (id: string, data: Partial<ABTestConfig>): Promise<ABTestConfig> => {
    const response = await client.put(`/ab-tests/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/ab-tests/${id}`);
  },

  start: async (id: string): Promise<ABTestConfig> => {
    const response = await client.post(`/ab-tests/${id}/start`);
    return response.data;
  },

  stop: async (id: string): Promise<ABTestConfig> => {
    const response = await client.post(`/ab-tests/${id}/stop`);
    return response.data;
  },

  getResults: async (id: string): Promise<{
    strategy_a_stats: {
      total_matches: number;
      avg_score: number;
      clue_distribution: Record<string, number>;
    };
    strategy_b_stats: {
      total_matches: number;
      avg_score: number;
      clue_distribution: Record<string, number>;
    };
    significance_test: {
      p_value: number;
      significant: boolean;
    };
  }> => {
    const response = await client.get(`/ab-tests/${id}/results`);
    return response.data;
  },
};
