import client from './client';
import type { Script, PaginatedResponse } from '@/types';

export interface ScriptQueryParams {
  page?: number;
  page_size?: number;
  difficulty?: Script['difficulty'];
  search?: string;
}

// Script APIs
export const scriptApi = {
  list: async (params: ScriptQueryParams = {}): Promise<PaginatedResponse<Script>> => {
    const response = await client.get('/scripts', { params });
    return response.data;
  },

  get: async (id: string): Promise<Script> => {
    const response = await client.get(`/scripts/${id}`);
    return response.data;
  },

  create: async (data: Partial<Script>): Promise<Script> => {
    const response = await client.post('/scripts', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Script>): Promise<Script> => {
    const response = await client.put(`/scripts/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/scripts/${id}`);
  },

  copy: async (id: string): Promise<Script> => {
    const response = await client.post(`/scripts/${id}/copy`);
    return response.data;
  },
};
