import client from './client';
import type { NPC, PaginatedResponse } from '@/types';

export interface NPCQueryParams {
  page?: number;
  page_size?: number;
  script_id?: string;
  search?: string;
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

  create: async (data: Partial<NPC>): Promise<NPC> => {
    const response = await client.post('/npcs', data);
    return response.data;
  },

  update: async (id: string, data: Partial<NPC>): Promise<NPC> => {
    const response = await client.put(`/npcs/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/npcs/${id}`);
  },
};
