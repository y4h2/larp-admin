import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { PaginatedResponse } from '@/types';

export type LLMConfigType = 'embedding' | 'chat';

type LLMConfigRow = Database['public']['Tables']['llm_configs']['Row'];
type LLMConfigInsert = Database['public']['Tables']['llm_configs']['Insert'];
type LLMConfigUpdate = Database['public']['Tables']['llm_configs']['Update'];

export interface EmbeddingOptions {
  similarity_threshold?: number;
  dimensions?: number;
}

export interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface LLMConfig {
  id: string;
  name: string;
  type: LLMConfigType;
  model: string;
  base_url: string;
  api_key_masked: string;
  is_default: boolean;
  options: EmbeddingOptions | ChatOptions;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LLMConfigQueryParams {
  page?: number;
  page_size?: number;
  type?: LLMConfigType;
  search?: string;
}

export interface LLMConfigCreateData {
  name: string;
  type: LLMConfigType;
  model: string;
  base_url: string;
  api_key: string;
  is_default?: boolean;
  options?: EmbeddingOptions | ChatOptions;
}

export interface LLMConfigUpdateData {
  name?: string;
  model?: string;
  base_url?: string;
  api_key?: string;
  is_default?: boolean;
  options?: EmbeddingOptions | ChatOptions;
}

// Mask API key for display
function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return '***';
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

// Transform database row to API response format
function transformRow(row: LLMConfigRow): LLMConfig {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    model: row.model,
    base_url: row.base_url,
    api_key_masked: maskApiKey(row.api_key),
    is_default: row.is_default,
    options: row.options as EmbeddingOptions | ChatOptions,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export const llmConfigApi = {
  list: async (params: LLMConfigQueryParams = {}): Promise<PaginatedResponse<LLMConfig>> => {
    const { page = 1, page_size = 20, type, search } = params;
    const from = (page - 1) * page_size;
    const to = from + page_size - 1;

    // RLS policy automatically filters deleted_at IS NULL
    let query = supabase
      .from('llm_configs')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(from, to);

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

  get: async (id: string): Promise<LLMConfig> => {
    // RLS policy automatically filters deleted_at IS NULL
    const { data, error } = await supabase
      .from('llm_configs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('LLM Config not found');

    return transformRow(data);
  },

  create: async (createData: LLMConfigCreateData): Promise<LLMConfig> => {
    // If setting as default, unset other defaults first
    if (createData.is_default) {
      await supabase
        .from('llm_configs')
        .update({ is_default: false })
        .eq('type', createData.type)
        .eq('is_default', true);
    }

    const insertData: LLMConfigInsert = {
      name: createData.name,
      type: createData.type,
      model: createData.model,
      base_url: createData.base_url,
      api_key: createData.api_key,
      is_default: createData.is_default ?? false,
      options: createData.options ?? {},
    };

    const { data, error } = await supabase
      .from('llm_configs')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return transformRow(data);
  },

  update: async (id: string, updateData: LLMConfigUpdateData): Promise<LLMConfig> => {
    // If setting as default, we need to know the type first
    if (updateData.is_default) {
      const { data: existing } = await supabase
        .from('llm_configs')
        .select('type')
        .eq('id', id)
        .single();

      if (existing) {
        await supabase
          .from('llm_configs')
          .update({ is_default: false })
          .eq('type', existing.type)
          .eq('is_default', true)
          .neq('id', id);
      }
    }

    const dbUpdate: LLMConfigUpdate = {};
    if (updateData.name !== undefined) dbUpdate.name = updateData.name;
    if (updateData.model !== undefined) dbUpdate.model = updateData.model;
    if (updateData.base_url !== undefined) dbUpdate.base_url = updateData.base_url;
    if (updateData.api_key !== undefined) dbUpdate.api_key = updateData.api_key;
    if (updateData.is_default !== undefined) dbUpdate.is_default = updateData.is_default;
    if (updateData.options !== undefined) dbUpdate.options = updateData.options;

    const { data, error } = await supabase
      .from('llm_configs')
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
      .from('llm_configs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
  },

  setDefault: async (id: string): Promise<LLMConfig> => {
    // Get current config to know its type
    const { data: existing, error: fetchError } = await supabase
      .from('llm_configs')
      .select('type')
      .eq('id', id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    // Unset other defaults of the same type
    await supabase
      .from('llm_configs')
      .update({ is_default: false })
      .eq('type', existing.type)
      .eq('is_default', true);

    // Set this one as default
    const { data, error } = await supabase
      .from('llm_configs')
      .update({ is_default: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return transformRow(data);
  },

  getDefaults: async (): Promise<Record<string, LLMConfig | null>> => {
    // RLS policy automatically filters deleted_at IS NULL
    const { data, error } = await supabase
      .from('llm_configs')
      .select('*')
      .eq('is_default', true);

    if (error) throw new Error(error.message);

    const result: Record<string, LLMConfig | null> = {
      embedding: null,
      chat: null,
    };

    for (const row of data ?? []) {
      result[row.type] = transformRow(row);
    }

    return result;
  },
};
