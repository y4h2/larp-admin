import type { Script, NPC } from '@/types';
import type { PromptTemplate } from './templates';
import type { LLMConfig } from './llmConfigs';
import client from './client';

export interface ReferenceData {
  scripts: Script[];
  npcs: NPC[];
  templates: PromptTemplate[];
  llm_configs: LLMConfig[];
}

export const referenceDataApi = {
  /**
   * Fetch all reference data in a single request.
   * This reduces the number of API calls from 4+ to 1 for pages
   * that need scripts, npcs, templates, and llm_configs.
   */
  get: async (): Promise<ReferenceData> => {
    const response = await client.get('/reference-data');
    return response.data;
  },
};
