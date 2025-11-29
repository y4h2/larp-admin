import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { Script, PaginatedResponse } from '@/types';
import { generateScriptId } from '@/utils/idGenerator';
import client from './client';

type ScriptRow = Database['public']['Tables']['scripts']['Row'];
type ScriptInsert = Database['public']['Tables']['scripts']['Insert'];
type ScriptUpdate = Database['public']['Tables']['scripts']['Update'];

export interface ScriptQueryParams {
  page?: number;
  page_size?: number;
  difficulty?: Script['difficulty'];
  search?: string;
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

// Transform database row to API response format
function transformRow(row: ScriptRow): Script {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    background: row.background,
    difficulty: row.difficulty as Script['difficulty'],
    truth: row.truth as Record<string, unknown> | null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

// Script APIs
export const scriptApi = {
  list: async (params: ScriptQueryParams = {}): Promise<PaginatedResponse<Script>> => {
    const { page = 1, page_size = 20, difficulty, search } = params;
    const from = (page - 1) * page_size;
    const to = from + page_size - 1;

    // RLS policy automatically filters deleted_at IS NULL
    let query = supabase
      .from('scripts')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (difficulty) {
      query = query.eq('difficulty', difficulty);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
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

  get: async (id: string): Promise<Script> => {
    // RLS policy automatically filters deleted_at IS NULL
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Script not found');

    return transformRow(data);
  },

  create: async (createData: Partial<Script>): Promise<Script> => {
    const insertData: ScriptInsert = {
      id: generateScriptId(),
      title: createData.title ?? 'Untitled Script',
      summary: createData.summary ?? null,
      background: createData.background ?? null,
      difficulty: createData.difficulty ?? 'medium',
      truth: createData.truth ?? null,
    };

    const { data, error } = await supabase
      .from('scripts')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return transformRow(data);
  },

  update: async (id: string, updateData: Partial<Script>): Promise<Script> => {
    const dbUpdate: ScriptUpdate = {};
    if (updateData.title !== undefined) dbUpdate.title = updateData.title;
    if (updateData.summary !== undefined) dbUpdate.summary = updateData.summary;
    if (updateData.background !== undefined) dbUpdate.background = updateData.background;
    if (updateData.difficulty !== undefined) dbUpdate.difficulty = updateData.difficulty;
    if (updateData.truth !== undefined) dbUpdate.truth = updateData.truth;

    const { data, error } = await supabase
      .from('scripts')
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
      .from('scripts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
  },

  // These endpoints stay on the backend (require server-side logic for complex operations)
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
