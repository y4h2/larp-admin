import type { Script, PaginatedResponse } from '@/types';
import client from './client';

export interface ScriptQueryParams {
  page?: number;
  page_size?: number;
  difficulty?: Script['difficulty'];
  search?: string;
}

export interface ScriptCreateData {
  title: string;
  summary?: string | null;
  background?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard';
  truth?: Record<string, unknown>;
}

export interface ScriptUpdateData {
  title?: string;
  summary?: string | null;
  background?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard';
  truth?: Record<string, unknown>;
}

// Export/Import types (kept for backend endpoints)
export interface NPCExportData {
  export_id: string;
  name: string;
  age?: number | null;
  background?: string | null;
  personality?: string | null;
  knowledge_scope?: Record<string, unknown>;
}

export interface ClueExportData {
  export_id: string;
  name: string;
  type: 'text' | 'image';
  detail: string;
  detail_for_npc: string;
  trigger_keywords: string[];
  trigger_semantic_summary: string;
  npc_export_id: string;
  prereq_clue_export_ids: string[];
}

export interface ScriptExportData {
  version: string;
  title: string;
  summary?: string | null;
  background?: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  truth?: Record<string, unknown>;
  npcs: NPCExportData[];
  clues: ClueExportData[];
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

  create: async (createData: ScriptCreateData): Promise<Script> => {
    const response = await client.post('/scripts', createData);
    return response.data;
  },

  update: async (id: string, updateData: ScriptUpdateData): Promise<Script> => {
    const response = await client.put(`/scripts/${id}`, updateData);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/scripts/${id}`);
  },

  copy: async (id: string): Promise<Script> => {
    const response = await client.post(`/scripts/${id}/copy`);
    return response.data;
  },

  export: async (id: string): Promise<ScriptExportData> => {
    const response = await client.get(`/scripts/${id}/export`);
    return response.data;
  },

  import: async (data: ScriptExportData, newTitle?: string): Promise<Script> => {
    const response = await client.post('/scripts/import', {
      data,
      new_title: newTitle,
    });
    return response.data;
  },
};
