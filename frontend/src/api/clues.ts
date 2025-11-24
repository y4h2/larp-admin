import client from './client';
import type { Clue, ClueVersion, PaginatedResponse } from '@/types';

export interface ClueQueryParams {
  page?: number;
  page_size?: number;
  script_id?: string;
  scene_id?: string;
  npc_id?: string;
  stage?: number;
  clue_type?: Clue['clue_type'];
  importance?: Clue['importance'];
  status?: Clue['status'];
  search?: string;
}

export interface ClueTreeNode {
  id: string;
  title: string;
  title_internal?: string;
  title_player?: string;
  clue_type: Clue['clue_type'];
  importance: Clue['importance'];
  stage: number;
  status: Clue['status'];
  prerequisite_clue_ids: string[];
  dependent_clue_ids: string[];
  // Backend uses these field names
  prerequisites?: string[];
  dependents?: string[];
  // Additional fields from Clue
  scene_id?: string | null;
  content_text?: string;
  content_type?: 'text' | 'image' | 'structured';
  npc_ids?: string[];
  version?: number;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
}

export interface ClueTreeData {
  nodes: ClueTreeNode[];
  edges: Array<{ source: string; target: string }>;
  issues: {
    dead_clues: string[];
    orphan_clues: string[];
    cycles: string[][];
  };
}

export const clueApi = {
  list: async (params: ClueQueryParams = {}): Promise<PaginatedResponse<Clue>> => {
    const response = await client.get('/clues', { params });
    return response.data;
  },

  get: async (id: string): Promise<Clue> => {
    const response = await client.get(`/clues/${id}`);
    return response.data;
  },

  create: async (data: Partial<Clue>): Promise<Clue> => {
    const response = await client.post('/clues', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Clue>): Promise<Clue> => {
    const response = await client.put(`/clues/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/clues/${id}`);
  },

  getVersions: async (id: string): Promise<ClueVersion[]> => {
    const response = await client.get(`/clues/${id}/versions`);
    return response.data;
  },

  restoreVersion: async (id: string, versionId: string): Promise<Clue> => {
    const response = await client.post(`/clues/${id}/versions/${versionId}/restore`);
    return response.data;
  },

  getTree: async (scriptId: string, sceneId?: string): Promise<ClueTreeData> => {
    const params = sceneId ? { scene_id: sceneId } : {};
    const response = await client.get(`/scripts/${scriptId}/clue-tree`, { params });
    return response.data;
  },

  updateDependencies: async (
    clueId: string,
    prerequisiteClueIds: string[]
  ): Promise<Clue> => {
    const response = await client.put(`/clues/${clueId}/dependencies`, {
      prerequisite_clue_ids: prerequisiteClueIds,
    });
    return response.data;
  },
};
