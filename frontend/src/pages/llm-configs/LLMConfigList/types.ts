import type { LLMConfigType } from '@/api/llmConfigs';

export const CONFIG_TYPES: LLMConfigType[] = ['embedding', 'chat'];

// Form values type (flat structure for form fields)
export interface LLMConfigFormValues {
  name: string;
  type: LLMConfigType;
  model: string;
  base_url: string;
  api_key: string;
  is_default?: boolean;
  // Embedding options
  similarity_threshold?: number;
  dimensions?: number;
  // Chat options
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface ListFilters {
  type?: LLMConfigType;
  search?: string;
  page: number;
  page_size: number;
}
