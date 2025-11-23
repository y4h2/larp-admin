import client from './client';
import type { Script, Scene, PaginatedResponse } from '@/types';

export interface ScriptQueryParams {
  page?: number;
  page_size?: number;
  status?: Script['status'];
  search?: string;
}

export interface SceneQueryParams {
  page?: number;
  page_size?: number;
  script_id: string;
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

  archive: async (id: string): Promise<Script> => {
    const response = await client.post(`/scripts/${id}/archive`);
    return response.data;
  },
};

// Scene APIs
export const sceneApi = {
  list: async (params: SceneQueryParams): Promise<PaginatedResponse<Scene>> => {
    const response = await client.get('/scenes', { params });
    return response.data;
  },

  get: async (id: string): Promise<Scene> => {
    const response = await client.get(`/scenes/${id}`);
    return response.data;
  },

  create: async (data: Partial<Scene>): Promise<Scene> => {
    const response = await client.post('/scenes', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Scene>): Promise<Scene> => {
    const response = await client.put(`/scenes/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/scenes/${id}`);
  },

  reorder: async (scriptId: string, sceneIds: string[]): Promise<void> => {
    await client.post(`/scripts/${scriptId}/scenes/reorder`, { scene_ids: sceneIds });
  },
};
