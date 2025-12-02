import type { Clue, PaginatedResponse } from '@/types';
import client from './client';

export interface ClueQueryParams {
  page?: number;
  page_size?: number;
  script_id?: string;
  npc_id?: string;
  type?: Clue['type'];
  search?: string;
}

export interface ClueCreateData {
  script_id: string;
  npc_id: string;
  name: string;
  type?: 'text' | 'image';
  detail?: string;
  detail_for_npc?: string;
  trigger_keywords?: string[];
  trigger_semantic_summary?: string;
  prereq_clue_ids?: string[];
}

export interface ClueUpdateData {
  name?: string;
  type?: 'text' | 'image';
  detail?: string;
  detail_for_npc?: string;
  trigger_keywords?: string[];
  trigger_semantic_summary?: string;
  prereq_clue_ids?: string[];
  npc_id?: string;
}

export interface ClueTreeNode {
  id: string;
  name: string;
  type: Clue['type'];
  npc_id: string;
  prereq_clue_ids: string[];
  // Optional fields that may be included
  detail?: string;
  trigger_keywords?: string[];
  created_at?: string;
  updated_at?: string;
  dependent_clue_ids?: string[];
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

  create: async (createData: ClueCreateData): Promise<Clue> => {
    const response = await client.post('/clues', createData);
    return response.data;
  },

  update: async (id: string, updateData: ClueUpdateData): Promise<Clue> => {
    const response = await client.put(`/clues/${id}`, updateData);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/clues/${id}`);
  },

  getTree: async (scriptId: string): Promise<ClueTreeData> => {
    const response = await client.get(`/scripts/${scriptId}/clue-tree`);
    return response.data;
  },

  updateDependencies: async (
    clueId: string,
    prereqClueIds: string[]
  ): Promise<Clue> => {
    const response = await client.put(`/clues/${clueId}`, {
      prereq_clue_ids: prereqClueIds,
    });
    return response.data;
  },
};
