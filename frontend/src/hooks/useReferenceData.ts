import { useState, useCallback, useMemo } from 'react';
import { message } from 'antd';
import { referenceDataApi, type ReferenceData } from '@/api/referenceData';
import type { Script, NPC } from '@/types';
import type { PromptTemplate } from '@/api/templates';
import type { LLMConfig } from '@/api/llmConfigs';
import { useAppStore } from '@/store';

/**
 * Hook for fetching all reference data in a single request.
 * This reduces API calls from 4+ to 1 for pages that need
 * scripts, npcs, templates, and llm_configs.
 */
export function useReferenceData() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReferenceData | null>(null);
  const { setNpcs: setGlobalNpcs, setClues: setGlobalClues } = useAppStore();

  const fetchReferenceData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await referenceDataApi.get();
      setData(response);
      // Update global store for NPCs (clues are not included in reference data)
      if (response.npcs) {
        setGlobalNpcs(response.npcs);
      }
      return response;
    } catch (error) {
      message.error('Failed to fetch reference data');
      setData(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setGlobalNpcs]);

  // Memoized accessors for individual data types
  const scripts = useMemo<Script[]>(() => data?.scripts ?? [], [data?.scripts]);
  const npcs = useMemo<NPC[]>(() => data?.npcs ?? [], [data?.npcs]);
  const templates = useMemo<PromptTemplate[]>(() => data?.templates ?? [], [data?.templates]);
  const llmConfigs = useMemo<LLMConfig[]>(() => data?.llm_configs ?? [], [data?.llm_configs]);

  // Helper to get NPCs for a specific script
  const getNpcsByScript = useCallback((scriptId: string): NPC[] => {
    return npcs.filter(npc => npc.script_id === scriptId);
  }, [npcs]);

  // Helper to get templates by type
  const getTemplatesByType = useCallback((type: string): PromptTemplate[] => {
    return templates.filter(t => t.type === type);
  }, [templates]);

  // Helper to get LLM configs by type
  const getLlmConfigsByType = useCallback((type: 'embedding' | 'chat'): LLMConfig[] => {
    return llmConfigs.filter(c => c.type === type);
  }, [llmConfigs]);

  // Helper to get default LLM configs
  const defaultLlmConfigs = useMemo(() => {
    return {
      embedding: llmConfigs.find(c => c.type === 'embedding' && c.is_default) ?? null,
      chat: llmConfigs.find(c => c.type === 'chat' && c.is_default) ?? null,
    };
  }, [llmConfigs]);

  // Helper to get default templates by type
  const defaultTemplates = useMemo(() => {
    const result: Record<string, PromptTemplate | null> = {};
    const types = ['clue_embedding', 'npc_system_prompt', 'clue_reveal', 'custom'];
    for (const type of types) {
      result[type] = templates.find(t => t.type === type && t.is_default) ?? null;
    }
    return result;
  }, [templates]);

  return {
    loading,
    data,
    scripts,
    npcs,
    templates,
    llmConfigs,
    fetchReferenceData,
    // Helpers
    getNpcsByScript,
    getTemplatesByType,
    getLlmConfigsByType,
    defaultLlmConfigs,
    defaultTemplates,
  };
}
