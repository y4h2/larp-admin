import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { PaginatedResponse } from '@/types';
import client from './client';

export type TemplateType = 'clue_embedding' | 'npc_system_prompt' | 'clue_reveal' | 'custom';

type TemplateRow = Database['public']['Tables']['prompt_templates']['Row'];
type TemplateInsert = Database['public']['Tables']['prompt_templates']['Insert'];
type TemplateUpdate = Database['public']['Tables']['prompt_templates']['Update'];

export interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  type: TemplateType;
  content: string;
  is_default: boolean;
  variables: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TemplateQueryParams {
  page?: number;
  page_size?: number;
  type?: TemplateType;
  search?: string;
}

export interface TemplateCreateData {
  name: string;
  description?: string;
  type: TemplateType;
  content: string;
  is_default?: boolean;
}

export interface TemplateUpdateData {
  name?: string;
  description?: string;
  type?: TemplateType;
  content?: string;
  is_default?: boolean;
}

export interface TemplateRenderRequest {
  template_id?: string;
  template_content?: string;
  context: Record<string, unknown>;
}

export interface TemplateRenderResponse {
  rendered_content: string;
  warnings: string[];
  unresolved_variables: string[];
}

export interface VariableInfo {
  name: string;
  description: string;
  type: string;
  example: string | null;
}

export interface VariableCategory {
  name: string;
  description: string;
  variables: VariableInfo[];
}

export interface AvailableVariablesResponse {
  categories: VariableCategory[];
}

// Extract variables from template content (simple regex extraction)
function extractVariables(content: string): string[] {
  const regex = /\{([^}]+)\}/g;
  const variables = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

// Transform database row to API response format
function transformRow(row: TemplateRow): PromptTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as TemplateType,
    content: row.content,
    is_default: row.is_default,
    variables: row.variables,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export const templateApi = {
  list: async (params: TemplateQueryParams = {}): Promise<PaginatedResponse<PromptTemplate>> => {
    const { page = 1, page_size = 20, type, search } = params;
    const from = (page - 1) * page_size;
    const to = from + page_size - 1;

    // RLS policy automatically filters deleted_at IS NULL
    let query = supabase
      .from('prompt_templates')
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

  get: async (id: string): Promise<PromptTemplate> => {
    // RLS policy automatically filters deleted_at IS NULL
    const { data, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Template not found');

    return transformRow(data);
  },

  create: async (createData: TemplateCreateData): Promise<PromptTemplate> => {
    // If setting as default, unset other defaults first
    if (createData.is_default) {
      await supabase
        .from('prompt_templates')
        .update({ is_default: false })
        .eq('type', createData.type)
        .eq('is_default', true);
    }

    const insertData: TemplateInsert = {
      name: createData.name,
      description: createData.description ?? null,
      type: createData.type,
      content: createData.content,
      is_default: createData.is_default ?? false,
      variables: extractVariables(createData.content),
    };

    const { data, error } = await supabase
      .from('prompt_templates')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return transformRow(data);
  },

  update: async (id: string, updateData: TemplateUpdateData): Promise<PromptTemplate> => {
    // If setting as default, we need to know the type first
    if (updateData.is_default) {
      const targetType = updateData.type;
      if (targetType) {
        await supabase
          .from('prompt_templates')
          .update({ is_default: false })
          .eq('type', targetType)
          .eq('is_default', true)
          .neq('id', id);
      } else {
        const { data: existing } = await supabase
          .from('prompt_templates')
          .select('type')
          .eq('id', id)
          .single();

        if (existing) {
          await supabase
            .from('prompt_templates')
            .update({ is_default: false })
            .eq('type', existing.type)
            .eq('is_default', true)
            .neq('id', id);
        }
      }
    }

    const dbUpdate: TemplateUpdate = {};
    if (updateData.name !== undefined) dbUpdate.name = updateData.name;
    if (updateData.description !== undefined) dbUpdate.description = updateData.description;
    if (updateData.type !== undefined) dbUpdate.type = updateData.type;
    if (updateData.content !== undefined) {
      dbUpdate.content = updateData.content;
      dbUpdate.variables = extractVariables(updateData.content);
    }
    if (updateData.is_default !== undefined) dbUpdate.is_default = updateData.is_default;

    const { data, error } = await supabase
      .from('prompt_templates')
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
      .from('prompt_templates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
  },

  duplicate: async (id: string): Promise<PromptTemplate> => {
    // Get original template
    const { data: original, error: fetchError } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    // Create duplicate
    const insertData: TemplateInsert = {
      name: `${original.name} (Copy)`,
      description: original.description,
      type: original.type as TemplateType,
      content: original.content,
      is_default: false,
      variables: original.variables,
    };

    const { data, error } = await supabase
      .from('prompt_templates')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return transformRow(data);
  },

  setDefault: async (id: string): Promise<PromptTemplate> => {
    // Get current template to know its type
    const { data: existing, error: fetchError } = await supabase
      .from('prompt_templates')
      .select('type')
      .eq('id', id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    // Unset other defaults of the same type
    await supabase
      .from('prompt_templates')
      .update({ is_default: false })
      .eq('type', existing.type)
      .eq('is_default', true);

    // Set this one as default
    const { data, error } = await supabase
      .from('prompt_templates')
      .update({ is_default: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return transformRow(data);
  },

  getDefaults: async (): Promise<Record<string, PromptTemplate | null>> => {
    // RLS policy automatically filters deleted_at IS NULL
    const { data, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('is_default', true);

    if (error) throw new Error(error.message);

    const result: Record<string, PromptTemplate | null> = {
      clue_embedding: null,
      npc_system_prompt: null,
      clue_reveal: null,
      custom: null,
    };

    for (const row of data ?? []) {
      result[row.type] = transformRow(row);
    }

    return result;
  },

  // These endpoints stay on the backend (require server-side logic)
  render: async (data: TemplateRenderRequest): Promise<TemplateRenderResponse> => {
    const response = await client.post('/templates/render', data);
    return response.data;
  },

  getAvailableVariables: async (): Promise<AvailableVariablesResponse> => {
    const response = await client.get('/templates/variables');
    return response.data;
  },
};
