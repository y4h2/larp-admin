import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { NPC, PaginatedResponse } from '@/types';

type NPCRow = Database['public']['Tables']['npcs']['Row'];
type NPCInsert = Database['public']['Tables']['npcs']['Insert'];
type NPCUpdate = Database['public']['Tables']['npcs']['Update'];

export interface NPCQueryParams {
  page?: number;
  page_size?: number;
  script_id?: string;
  search?: string;
}

// Transform database row to API response format
function transformRow(row: NPCRow): NPC {
  return {
    id: row.id,
    script_id: row.script_id,
    name: row.name,
    age: row.age,
    background: row.background,
    personality: row.personality,
    knowledge_scope: row.knowledge_scope as Record<string, unknown> | null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export const npcApi = {
  list: async (params: NPCQueryParams = {}): Promise<PaginatedResponse<NPC>> => {
    const { page = 1, page_size = 20, script_id, search } = params;
    const from = (page - 1) * page_size;
    const to = from + page_size - 1;

    // RLS policy automatically filters deleted_at IS NULL
    let query = supabase
      .from('npcs')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (script_id) {
      query = query.eq('script_id', script_id);
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

  get: async (id: string): Promise<NPC> => {
    // RLS policy automatically filters deleted_at IS NULL
    const { data, error } = await supabase
      .from('npcs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('NPC not found');

    return transformRow(data);
  },

  create: async (createData: Partial<NPC>): Promise<NPC> => {
    if (!createData.script_id) {
      throw new Error('script_id is required');
    }

    const insertData: NPCInsert = {
      script_id: createData.script_id,
      name: createData.name ?? 'Unnamed NPC',
      age: createData.age ?? null,
      background: createData.background ?? null,
      personality: createData.personality ?? null,
      knowledge_scope: createData.knowledge_scope ?? null,
    };

    const { data, error } = await supabase
      .from('npcs')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return transformRow(data);
  },

  update: async (id: string, updateData: Partial<NPC>): Promise<NPC> => {
    const dbUpdate: NPCUpdate = {};
    if (updateData.name !== undefined) dbUpdate.name = updateData.name;
    if (updateData.age !== undefined) dbUpdate.age = updateData.age;
    if (updateData.background !== undefined) dbUpdate.background = updateData.background;
    if (updateData.personality !== undefined) dbUpdate.personality = updateData.personality;
    if (updateData.knowledge_scope !== undefined) dbUpdate.knowledge_scope = updateData.knowledge_scope;

    const { data, error } = await supabase
      .from('npcs')
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
      .from('npcs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
  },
};
