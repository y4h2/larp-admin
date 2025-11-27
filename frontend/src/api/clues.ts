import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { Clue, PaginatedResponse } from '@/types';
import client from './client';

type ClueRow = Database['public']['Tables']['clues']['Row'];
type ClueInsert = Database['public']['Tables']['clues']['Insert'];
type ClueUpdate = Database['public']['Tables']['clues']['Update'];

export interface ClueQueryParams {
  page?: number;
  page_size?: number;
  script_id?: string;
  npc_id?: string;
  type?: Clue['type'];
  search?: string;
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

// Transform database row to API response format
function transformRow(row: ClueRow): Clue {
  return {
    id: row.id,
    script_id: row.script_id,
    npc_id: row.npc_id,
    name: row.name,
    type: row.type as Clue['type'],
    detail: row.detail,
    detail_for_npc: row.detail_for_npc,
    trigger_keywords: row.trigger_keywords,
    trigger_semantic_summary: row.trigger_semantic_summary,
    prereq_clue_ids: row.prereq_clue_ids,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export const clueApi = {
  list: async (params: ClueQueryParams = {}): Promise<PaginatedResponse<Clue>> => {
    const { page = 1, page_size = 20, script_id, npc_id, type, search } = params;
    const from = (page - 1) * page_size;
    const to = from + page_size - 1;

    // RLS policy automatically filters deleted_at IS NULL
    let query = supabase
      .from('clues')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (script_id) {
      query = query.eq('script_id', script_id);
    }

    if (npc_id) {
      query = query.eq('npc_id', npc_id);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);

    const total = count ?? 0;
    const items = (data ?? []).map(transformRow);

    return {
      items,
      total,
      page,
      page_size,
      total_pages: Math.ceil(total / page_size),
    };
  },

  get: async (id: string): Promise<Clue> => {
    // RLS policy automatically filters deleted_at IS NULL
    const { data, error } = await supabase
      .from('clues')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Clue not found');

    return transformRow(data);
  },

  create: async (createData: Partial<Clue>): Promise<Clue> => {
    if (!createData.script_id || !createData.npc_id) {
      throw new Error('script_id and npc_id are required');
    }

    const insertData: ClueInsert = {
      script_id: createData.script_id,
      npc_id: createData.npc_id,
      name: createData.name ?? 'Unnamed Clue',
      type: createData.type ?? 'text',
      detail: createData.detail ?? '',
      detail_for_npc: createData.detail_for_npc ?? '',
      trigger_keywords: createData.trigger_keywords ?? [],
      trigger_semantic_summary: createData.trigger_semantic_summary ?? '',
      prereq_clue_ids: createData.prereq_clue_ids ?? [],
    };

    const { data, error } = await supabase
      .from('clues')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return transformRow(data);
  },

  update: async (id: string, updateData: Partial<Clue>): Promise<Clue> => {
    const dbUpdate: ClueUpdate = {};
    if (updateData.name !== undefined) dbUpdate.name = updateData.name;
    if (updateData.type !== undefined) dbUpdate.type = updateData.type;
    if (updateData.detail !== undefined) dbUpdate.detail = updateData.detail;
    if (updateData.detail_for_npc !== undefined) dbUpdate.detail_for_npc = updateData.detail_for_npc;
    if (updateData.trigger_keywords !== undefined) dbUpdate.trigger_keywords = updateData.trigger_keywords;
    if (updateData.trigger_semantic_summary !== undefined) dbUpdate.trigger_semantic_summary = updateData.trigger_semantic_summary;
    if (updateData.prereq_clue_ids !== undefined) dbUpdate.prereq_clue_ids = updateData.prereq_clue_ids;
    if (updateData.npc_id !== undefined) dbUpdate.npc_id = updateData.npc_id;

    const { data, error } = await supabase
      .from('clues')
      .update(dbUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return transformRow(data);
  },

  delete: async (id: string): Promise<void> => {
    // Soft delete
    const { error } = await supabase
      .from('clues')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
  },

  // These endpoints stay on the backend (require server-side logic for complex graph operations)
  getTree: async (scriptId: string): Promise<ClueTreeData> => {
    const response = await client.get(`/scripts/${scriptId}/clue-tree`);
    return response.data;
  },

  updateDependencies: async (
    clueId: string,
    prereqClueIds: string[]
  ): Promise<Clue> => {
    // This can actually be done via Supabase directly now
    const { data, error } = await supabase
      .from('clues')
      .update({ prereq_clue_ids: prereqClueIds })
      .eq('id', clueId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return transformRow(data);
  },
};
