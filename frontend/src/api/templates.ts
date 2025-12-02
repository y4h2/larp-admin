import type { PaginatedResponse } from '@/types';
import client from './client';

export type TemplateType = 'clue_embedding' | 'npc_system_prompt' | 'clue_reveal' | 'custom';

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

// Export/Import types
export interface TemplateExportItem {
  name: string;
  description: string | null;
  type: TemplateType;
  content: string;
  is_default: boolean;
}

export interface TemplateExportData {
  version: string;
  exported_at: string;
  templates: TemplateExportItem[];
}

export const templateApi = {
  list: async (params: TemplateQueryParams = {}): Promise<PaginatedResponse<PromptTemplate>> => {
    const response = await client.get('/templates', { params });
    return response.data;
  },

  get: async (id: string): Promise<PromptTemplate> => {
    const response = await client.get(`/templates/${id}`);
    return response.data;
  },

  create: async (createData: TemplateCreateData): Promise<PromptTemplate> => {
    const response = await client.post('/templates', createData);
    return response.data;
  },

  update: async (id: string, updateData: TemplateUpdateData): Promise<PromptTemplate> => {
    const response = await client.put(`/templates/${id}`, updateData);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/templates/${id}`);
  },

  duplicate: async (id: string): Promise<PromptTemplate> => {
    const response = await client.post(`/templates/${id}/duplicate`);
    return response.data;
  },

  setDefault: async (id: string): Promise<PromptTemplate> => {
    const response = await client.post(`/templates/${id}/set-default`);
    return response.data;
  },

  getDefaults: async (): Promise<Record<string, PromptTemplate | null>> => {
    const response = await client.get('/templates/defaults');
    return response.data;
  },

  render: async (data: TemplateRenderRequest): Promise<TemplateRenderResponse> => {
    const response = await client.post('/templates/render', data);
    return response.data;
  },

  getAvailableVariables: async (): Promise<AvailableVariablesResponse> => {
    const response = await client.get('/templates/variables');
    return response.data;
  },
};
