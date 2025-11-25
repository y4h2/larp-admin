import client from './client';
import type { PaginatedResponse } from '@/types';

export type LLMConfigType = 'embedding' | 'chat';

export interface EmbeddingOptions {
  similarity_threshold?: number;
  dimensions?: number;
}

export interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface LLMConfig {
  id: string;
  name: string;
  type: LLMConfigType;
  model: string;
  base_url: string;
  api_key_masked: string;
  is_default: boolean;
  options: EmbeddingOptions | ChatOptions;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LLMConfigQueryParams {
  page?: number;
  page_size?: number;
  type?: LLMConfigType;
  search?: string;
}

export interface LLMConfigCreateData {
  name: string;
  type: LLMConfigType;
  model: string;
  base_url: string;
  api_key: string;
  is_default?: boolean;
  options?: EmbeddingOptions | ChatOptions;
}

export interface LLMConfigUpdateData {
  name?: string;
  model?: string;
  base_url?: string;
  api_key?: string;
  is_default?: boolean;
  options?: EmbeddingOptions | ChatOptions;
}

export const llmConfigApi = {
  list: async (params: LLMConfigQueryParams = {}): Promise<PaginatedResponse<LLMConfig>> => {
    const response = await client.get('/llm-configs', { params });
    return response.data;
  },

  get: async (id: string): Promise<LLMConfig> => {
    const response = await client.get(`/llm-configs/${id}`);
    return response.data;
  },

  create: async (data: LLMConfigCreateData): Promise<LLMConfig> => {
    const response = await client.post('/llm-configs', data);
    return response.data;
  },

  update: async (id: string, data: LLMConfigUpdateData): Promise<LLMConfig> => {
    const response = await client.put(`/llm-configs/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/llm-configs/${id}`);
  },

  setDefault: async (id: string): Promise<LLMConfig> => {
    const response = await client.post(`/llm-configs/${id}/set-default`);
    return response.data;
  },

  getDefaults: async (): Promise<Record<string, LLMConfig | null>> => {
    const response = await client.get('/llm-configs/defaults');
    return response.data;
  },
};
