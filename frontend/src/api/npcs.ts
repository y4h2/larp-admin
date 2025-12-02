import type { NPC, PaginatedResponse } from '@/types';
import client from './client';

export interface NPCQueryParams {
  page?: number;
  page_size?: number;
  script_id?: string;
  search?: string;
}

export interface NPCCreateData {
  script_id: string;
  name: string;
  age?: number | null;
  background?: string | null;
  personality?: string | null;
  knowledge_scope?: Record<string, unknown>;
}

export interface NPCUpdateData {
  name?: string;
  age?: number | null;
  background?: string | null;
  personality?: string | null;
  knowledge_scope?: Record<string, unknown>;
}

export const npcApi = {
  list: async (params: NPCQueryParams = {}): Promise<PaginatedResponse<NPC>> => {
    const response = await client.get('/npcs', { params });
    return response.data;
  },

  get: async (id: string): Promise<NPC> => {
    const response = await client.get(`/npcs/${id}`);
    return response.data;
  },

  create: async (createData: NPCCreateData): Promise<NPC> => {
    const response = await client.post('/npcs', createData);
    return response.data;
  },

  update: async (id: string, updateData: NPCUpdateData): Promise<NPC> => {
    const response = await client.put(`/npcs/${id}`, updateData);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/npcs/${id}`);
  },
};
