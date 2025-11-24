import client from './client';
import type { PaginatedResponse } from '@/types';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  type: 'system' | 'npc_dialog' | 'clue_explain';
  scope_type: 'global' | 'script' | 'npc';
  scope_target_id: string | null;
  content: string;
  variables_meta: Record<string, unknown>;
  status: 'draft' | 'active' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface TemplateQueryParams {
  page?: number;
  page_size?: number;
  type?: PromptTemplate['type'];
  scope_type?: PromptTemplate['scope_type'];
  scope_target_id?: string;
  status?: PromptTemplate['status'];
  search?: string;
}

export interface TemplateCreateData {
  name: string;
  description?: string;
  type: PromptTemplate['type'];
  scope_type?: PromptTemplate['scope_type'];
  scope_target_id?: string;
  content: string;
  status?: PromptTemplate['status'];
  created_by?: string;
}

export interface TemplateUpdateData {
  name?: string;
  description?: string;
  type?: PromptTemplate['type'];
  scope_type?: PromptTemplate['scope_type'];
  scope_target_id?: string;
  content?: string;
  status?: PromptTemplate['status'];
  updated_by?: string;
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

export const templateApi = {
  list: async (params: TemplateQueryParams = {}): Promise<PaginatedResponse<PromptTemplate>> => {
    const response = await client.get('/templates', { params });
    return response.data;
  },

  get: async (id: string): Promise<PromptTemplate> => {
    const response = await client.get(`/templates/${id}`);
    return response.data;
  },

  create: async (data: TemplateCreateData): Promise<PromptTemplate> => {
    const response = await client.post('/templates', data);
    return response.data;
  },

  update: async (id: string, data: TemplateUpdateData): Promise<PromptTemplate> => {
    const response = await client.put(`/templates/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/templates/${id}`);
  },

  duplicate: async (id: string): Promise<PromptTemplate> => {
    const response = await client.post(`/templates/${id}/duplicate`);
    return response.data;
  },

  render: async (data: TemplateRenderRequest): Promise<TemplateRenderResponse> => {
    const response = await client.post('/templates/render', data);
    return response.data;
  },

  getAvailableVariables: async (): Promise<AvailableVariablesResponse> => {
    const response = await client.get('/templates/variables/available');
    return response.data;
  },
};
