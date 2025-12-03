import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { message } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { simulationApi, clueApi } from '@/api';
import { templateApi, type TemplateRenderResponse } from '@/api/templates';
import { useReferenceData } from '@/hooks/useReferenceData';
import { usePresets, type PresetConfig } from '@/hooks';
import type { Clue, MatchedClue, MatchingStrategy } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { loadStoredConfig, saveConfig, type ChatMessage, type VectorBackend } from '../types';

export function useDialogueSimulation(t: (key: string, params?: Record<string, unknown>) => string) {
  const { user } = useAuth();

  // Use aggregated reference data API (1 request instead of 4)
  const {
    scripts,
    npcs: allNpcs,
    templates,
    llmConfigs,
    fetchReferenceData,
    getNpcsByScript,
    getLlmConfigsByType,
  } = useReferenceData();

  const {
    history: presetHistory,
    favorites: presetFavorites,
    addToHistory,
    addToFavorites,
    updateFavorite,
    removeFromFavorites,
    clearHistory,
    getPresetById,
    exportFavorites,
    importFavorites,
  } = usePresets();

  const [clues, setClues] = useState<Clue[]>([]);

  // Load stored config on initial render
  const storedConfig = useMemo(() => loadStoredConfig(), []);

  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(
    storedConfig.selectedScriptId ?? null
  );
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(
    storedConfig.selectedNpcId ?? null
  );
  const [unlockedClueIds, setUnlockedClueIds] = useState<string[]>([]);

  // Session tracking
  const sessionIdRef = useRef<string>(uuidv4());

  // Matching configuration
  const [matchingStrategy, setMatchingStrategy] = useState<MatchingStrategy>(
    storedConfig.matchingStrategy === 'keyword' ? 'llm' : (storedConfig.matchingStrategy ?? 'llm')
  );
  const [matchingTemplateId, setMatchingTemplateId] = useState<string | undefined>(
    storedConfig.matchingTemplateId
  );
  const [matchingLlmConfigId, setMatchingLlmConfigId] = useState<string | undefined>(
    storedConfig.matchingLlmConfigId
  );

  // NPC reply configuration
  const [enableNpcReply, setEnableNpcReply] = useState(storedConfig.enableNpcReply ?? false);
  const [npcClueTemplateId, setNpcClueTemplateId] = useState<string | undefined>(
    storedConfig.npcClueTemplateId
  );
  const [npcNoClueTemplateId, setNpcNoClueTemplateId] = useState<string | undefined>(
    storedConfig.npcNoClueTemplateId
  );
  const [npcChatConfigId, setNpcChatConfigId] = useState<string | undefined>(
    storedConfig.npcChatConfigId
  );

  // Runtime override options
  const [overrideSimilarityThreshold, setOverrideSimilarityThreshold] = useState<number | undefined>(
    storedConfig.overrideSimilarityThreshold
  );
  const [overrideTemperature, setOverrideTemperature] = useState<number | undefined>(
    storedConfig.overrideTemperature
  );
  const [overrideMaxTokens, setOverrideMaxTokens] = useState<number | undefined>(
    storedConfig.overrideMaxTokens
  );
  const [overrideVectorBackend, setOverrideVectorBackend] = useState<VectorBackend | undefined>(
    storedConfig.overrideVectorBackend
  );

  // LLM matching options
  const [llmReturnAllScores, setLlmReturnAllScores] = useState<boolean>(
    storedConfig.llmReturnAllScores ?? false
  );
  const [llmScoreThreshold, setLlmScoreThreshold] = useState<number | undefined>(
    storedConfig.llmScoreThreshold
  );

  // Username from current user
  const username = user?.email || '';

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [playerMessage, setPlayerMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Favorite modal state
  const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [favoriteName, setFavoriteName] = useState('');
  const [favoriteNote, setFavoriteNote] = useState('');
  const [editingFavoriteId, setEditingFavoriteId] = useState<string | null>(null);

  // Match results
  const [lastMatchResults, setLastMatchResults] = useState<MatchedClue[] | null>(null);
  const [lastDebugInfo, setLastDebugInfo] = useState<Record<string, unknown> | null>(null);

  // Template rendering
  const [renderedPreviews, setRenderedPreviews] = useState<Record<string, TemplateRenderResponse>>({});
  const [renderingClueId, setRenderingClueId] = useState<string | null>(null);
  const [npcClueTemplatePreview, setNpcClueTemplatePreview] = useState<TemplateRenderResponse | null>(null);
  const [npcNoClueTemplatePreview, setNpcNoClueTemplatePreview] = useState<TemplateRenderResponse | null>(null);
  const [renderingNpcClueTemplate, setRenderingNpcClueTemplate] = useState(false);
  const [renderingNpcNoClueTemplate, setRenderingNpcNoClueTemplate] = useState(false);

  // Filter templates by type
  const matchingTemplates = useMemo(() =>
    templates.filter((tpl) => ['clue_embedding', 'clue_reveal', 'custom'].includes(tpl.type)),
    [templates]
  );
  const npcSystemTemplates = useMemo(() =>
    templates.filter((tpl) => ['npc_system_prompt', 'custom'].includes(tpl.type)),
    [templates]
  );

  // Computed values from reference data
  const npcs = useMemo(() => {
    return selectedScriptId ? getNpcsByScript(selectedScriptId) : allNpcs;
  }, [selectedScriptId, getNpcsByScript, allNpcs]);

  const embeddingConfigs = useMemo(() => getLlmConfigsByType('embedding'), [getLlmConfigsByType]);
  const chatConfigs = useMemo(() => getLlmConfigsByType('chat'), [getLlmConfigsByType]);

  // Memoized selections
  const selectedMatchingTemplate = useMemo(() => {
    return templates.find((tpl) => tpl.id === matchingTemplateId) || null;
  }, [templates, matchingTemplateId]);

  const selectedNpcClueTemplate = useMemo(() => {
    return templates.find((tpl) => tpl.id === npcClueTemplateId) || null;
  }, [templates, npcClueTemplateId]);

  const selectedNpcNoClueTemplate = useMemo(() => {
    return templates.find((tpl) => tpl.id === npcNoClueTemplateId) || null;
  }, [templates, npcNoClueTemplateId]);

  const selectedNpc = useMemo(() => {
    return npcs.find((n) => n.id === selectedNpcId) || null;
  }, [npcs, selectedNpcId]);

  const selectedScript = useMemo(() => {
    return scripts.find((s) => s.id === selectedScriptId) || null;
  }, [scripts, selectedScriptId]);

  const selectedMatchingConfig = useMemo(() => {
    if (matchingStrategy === 'embedding') {
      return embeddingConfigs.find((c) => c.id === matchingLlmConfigId);
    } else if (matchingStrategy === 'llm') {
      return chatConfigs.find((c) => c.id === matchingLlmConfigId);
    }
    return undefined;
  }, [matchingStrategy, matchingLlmConfigId, embeddingConfigs, chatConfigs]);

  const selectedNpcChatConfig = useMemo(() => {
    return chatConfigs.find((c) => c.id === npcChatConfigId);
  }, [chatConfigs, npcChatConfigId]);

  // Total clues for selected NPC
  const npcClues = useMemo(() => {
    if (!selectedNpcId) return clues;
    return clues.filter((c) => c.npc_id === selectedNpcId);
  }, [clues, selectedNpcId]);

  const lockedClues = useMemo(() => {
    const unlockedSet = new Set(unlockedClueIds || []);
    return npcClues.filter((c) => !unlockedSet.has(c.id));
  }, [npcClues, unlockedClueIds]);

  // Helper to get NPC name by ID
  const getNpcName = useCallback((npcId: string) => {
    const npc = npcs.find((n) => n.id === npcId);
    return npc?.name || npcId;
  }, [npcs]);

  // Helper functions
  const getCurrentConfig = useCallback((): PresetConfig => ({
    selectedScriptId,
    selectedNpcId,
    matchingStrategy,
    matchingTemplateId,
    matchingLlmConfigId,
    enableNpcReply,
    npcClueTemplateId,
    npcNoClueTemplateId,
    npcChatConfigId,
    overrideSimilarityThreshold,
    overrideTemperature,
    overrideMaxTokens,
    overrideVectorBackend,
    llmReturnAllScores,
    llmScoreThreshold,
  }), [
    selectedScriptId, selectedNpcId, matchingStrategy, matchingTemplateId, matchingLlmConfigId,
    enableNpcReply, npcClueTemplateId, npcNoClueTemplateId, npcChatConfigId,
    overrideSimilarityThreshold, overrideTemperature, overrideMaxTokens, overrideVectorBackend,
    llmReturnAllScores, llmScoreThreshold,
  ]);

  const getPresetDisplayName = useCallback((): string => {
    const strategyLabels: Record<MatchingStrategy, string> = {
      keyword: t('debug.keywordMatching'),
      embedding: t('debug.embeddingMatching'),
      llm: t('debug.llmMatching'),
    };
    const parts = [
      selectedScript?.title || t('debug.notConfigured'),
      selectedNpc?.name || t('debug.notConfigured'),
      strategyLabels[matchingStrategy],
    ];
    return parts.join(' · ');
  }, [t, selectedScript, selectedNpc, matchingStrategy]);

  const loadPreset = useCallback((config: PresetConfig) => {
    setSelectedScriptId(config.selectedScriptId);
    setSelectedNpcId(config.selectedNpcId);
    setMatchingStrategy(config.matchingStrategy);
    setMatchingTemplateId(config.matchingTemplateId);
    setMatchingLlmConfigId(config.matchingLlmConfigId);
    setEnableNpcReply(config.enableNpcReply);
    setNpcClueTemplateId(config.npcClueTemplateId);
    setNpcNoClueTemplateId(config.npcNoClueTemplateId);
    setNpcChatConfigId(config.npcChatConfigId);
    setOverrideSimilarityThreshold(config.overrideSimilarityThreshold);
    setOverrideTemperature(config.overrideTemperature);
    setOverrideMaxTokens(config.overrideMaxTokens);
    setOverrideVectorBackend(config.overrideVectorBackend);
    setLlmReturnAllScores(config.llmReturnAllScores ?? false);
    setLlmScoreThreshold(config.llmScoreThreshold);
    message.success(t('debug.presetLoaded'));
  }, [t]);

  const handlePresetSelect = useCallback((presetId: string) => {
    const config = getPresetById(presetId);
    if (config) {
      loadPreset(config);
    }
  }, [getPresetById, loadPreset]);

  const handleSaveToFavorites = useCallback(() => {
    if (!favoriteName.trim()) {
      message.warning(t('debug.enterPresetName'));
      return;
    }

    if (editingFavoriteId) {
      updateFavorite(editingFavoriteId, {
        name: favoriteName.trim(),
        note: favoriteNote.trim() || undefined,
      });
      message.success(t('debug.presetUpdated'));
    } else {
      addToFavorites(getCurrentConfig(), favoriteName.trim(), favoriteNote.trim() || undefined);
      message.success(t('debug.presetSaved'));
    }

    setFavoriteModalOpen(false);
    setFavoriteName('');
    setFavoriteNote('');
    setEditingFavoriteId(null);
  }, [t, favoriteName, favoriteNote, editingFavoriteId, getCurrentConfig, addToFavorites, updateFavorite]);

  const handleEditFavorite = useCallback((favorite: typeof presetFavorites[0]) => {
    setEditingFavoriteId(favorite.id);
    setFavoriteName(favorite.name);
    setFavoriteNote(favorite.note || '');
    setFavoriteModalOpen(true);
  }, []);

  // Effects - Fetch all reference data on mount (1 request instead of 4)
  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  useEffect(() => {
    saveConfig({
      selectedScriptId,
      selectedNpcId,
      matchingStrategy,
      matchingTemplateId,
      matchingLlmConfigId,
      enableNpcReply,
      npcClueTemplateId,
      npcNoClueTemplateId,
      npcChatConfigId,
      overrideSimilarityThreshold,
      overrideTemperature,
      overrideMaxTokens,
      overrideVectorBackend,
      llmReturnAllScores,
      llmScoreThreshold,
    });
  }, [
    selectedScriptId, selectedNpcId, matchingStrategy, matchingTemplateId, matchingLlmConfigId,
    enableNpcReply, npcClueTemplateId, npcNoClueTemplateId, npcChatConfigId,
    overrideSimilarityThreshold, overrideTemperature, overrideMaxTokens, overrideVectorBackend,
    llmReturnAllScores, llmScoreThreshold,
  ]);

  // Fetch clues when script changes (NPCs are already in reference data)
  useEffect(() => {
    if (selectedScriptId) {
      clueApi.list({ script_id: selectedScriptId, page_size: 100 }).then((res) => setClues(res?.items ?? [])).catch(() => setClues([]));
    }
  }, [selectedScriptId]);

  // Clear rendered previews when template or NPC changes
  // Note: Removed automatic rendering of all clues to reduce API calls
  // Users can click individual clues to render them on demand via handleRenderClue
  useEffect(() => {
    setRenderedPreviews({});
  }, [matchingTemplateId, selectedNpcId]);

  // Handlers
  const handleSend = useCallback(async () => {
    if (!selectedScriptId || !selectedNpcId || !playerMessage.trim()) {
      message.warning(t('debug.fillAllFields'));
      return;
    }

    addToHistory(getCurrentConfig(), getPresetDisplayName());

    const newPlayerMessage: ChatMessage = { role: 'player', content: playerMessage, timestamp: Date.now() };
    setChatHistory((prev) => [...prev, newPlayerMessage]);
    setPlayerMessage('');
    setLoading(true);
    setLastMatchResults(null);
    setLastDebugInfo(null);

    try {
      const result = await simulationApi.run({
        script_id: selectedScriptId,
        npc_id: selectedNpcId,
        unlocked_clue_ids: unlockedClueIds,
        player_message: playerMessage,
        matching_strategy: matchingStrategy,
        template_id: matchingTemplateId,
        llm_config_id: matchingLlmConfigId,
        npc_clue_template_id: enableNpcReply ? npcClueTemplateId : undefined,
        npc_no_clue_template_id: enableNpcReply ? npcNoClueTemplateId : undefined,
        npc_chat_config_id: enableNpcReply ? npcChatConfigId : undefined,
        session_id: sessionIdRef.current,
        username: username || undefined,
        save_log: true,
        embedding_options_override: (overrideSimilarityThreshold !== undefined || overrideVectorBackend !== undefined)
          ? { similarity_threshold: overrideSimilarityThreshold, vector_backend: overrideVectorBackend } : undefined,
        chat_options_override: (overrideTemperature !== undefined || overrideMaxTokens !== undefined || llmScoreThreshold !== undefined)
          ? { temperature: overrideTemperature, max_tokens: overrideMaxTokens, score_threshold: llmScoreThreshold } : undefined,
        llm_return_all_scores: llmReturnAllScores,
      });

      setLastMatchResults(result.matched_clues);
      setLastDebugInfo(result.debug_info);

      const systemMessage: ChatMessage = {
        role: 'system',
        content: `${t('debug.cluesTriggered', { count: result.triggered_clues.length })}`,
        result,
        timestamp: Date.now(),
      };
      setChatHistory((prev) => [...prev, systemMessage]);

      if (enableNpcReply && result.npc_response) {
        const triggeredCount = result.triggered_clues.length;
        const npcMessage: ChatMessage = {
          role: 'npc',
          content: result.npc_response,
          hasTriggeredClues: triggeredCount > 0,
          triggeredClueCount: triggeredCount,
          timestamp: Date.now(),
        };
        setChatHistory((prev) => [...prev, npcMessage]);
      }
    } catch {
      message.error(t('debug.simulationFailed'));
    } finally {
      setLoading(false);
    }
  }, [
    t, selectedScriptId, selectedNpcId, playerMessage, unlockedClueIds, matchingStrategy,
    matchingTemplateId, matchingLlmConfigId, enableNpcReply, npcClueTemplateId, npcNoClueTemplateId,
    npcChatConfigId, username, overrideSimilarityThreshold, overrideVectorBackend,
    overrideTemperature, overrideMaxTokens, llmScoreThreshold, llmReturnAllScores,
    getCurrentConfig, getPresetDisplayName, addToHistory,
  ]);

  const handleClear = useCallback(() => {
    setChatHistory([]);
    setUnlockedClueIds([]);
    setLastMatchResults(null);
    setLastDebugInfo(null);
    sessionIdRef.current = uuidv4();
  }, []);

  const handleRenderClue = useCallback(async (clue: Clue) => {
    if (!matchingTemplateId) {
      message.warning(t('debug.selectTemplateFirst'));
      return;
    }
    setRenderingClueId(clue.id);
    try {
      const result = await templateApi.render({
        template_id: matchingTemplateId,
        context: {
          clue: {
            id: clue.id, name: clue.name, type: clue.type, detail: clue.detail,
            detail_for_npc: clue.detail_for_npc, trigger_keywords: clue.trigger_keywords,
            trigger_semantic_summary: clue.trigger_semantic_summary,
          },
          npc: selectedNpc ? {
            id: selectedNpc.id, name: selectedNpc.name, age: selectedNpc.age,
            personality: selectedNpc.personality, background: selectedNpc.background,
            knowledge_scope: {
              knows: selectedNpc.knowledge_scope?.knows || [],
              does_not_know: selectedNpc.knowledge_scope?.does_not_know || [],
              world_model_limits: selectedNpc.knowledge_scope?.world_model_limits || [],
            },
          } : null,
        },
      });
      setRenderedPreviews((prev) => ({ ...prev, [clue.id]: result }));
    } catch {
      message.error(t('debug.renderFailed'));
    } finally {
      setRenderingClueId(null);
    }
  }, [t, matchingTemplateId, selectedNpc]);

  const handleRenderNpcClueTemplate = useCallback(async () => {
    if (!npcClueTemplateId) return;
    setRenderingNpcClueTemplate(true);
    try {
      const result = await templateApi.render({
        template_id: npcClueTemplateId,
        context: {
          npc: selectedNpc ? {
            id: selectedNpc.id, name: selectedNpc.name, age: selectedNpc.age,
            personality: selectedNpc.personality, background: selectedNpc.background,
            knowledge_scope: {
              knows: selectedNpc.knowledge_scope?.knows || [],
              does_not_know: selectedNpc.knowledge_scope?.does_not_know || [],
              world_model_limits: selectedNpc.knowledge_scope?.world_model_limits || [],
            },
          } : {},
          script: selectedScript ? {
            id: selectedScript.id, title: selectedScript.title, background: selectedScript.background,
          } : {},
          clue_guides: ['示例线索指引1', '示例线索指引2'],
          has_clue: true,
        },
      });
      setNpcClueTemplatePreview(result);
    } catch {
      message.error(t('debug.renderFailed'));
    } finally {
      setRenderingNpcClueTemplate(false);
    }
  }, [t, npcClueTemplateId, selectedNpc, selectedScript]);

  const handleRenderNpcNoClueTemplate = useCallback(async () => {
    if (!npcNoClueTemplateId) return;
    setRenderingNpcNoClueTemplate(true);
    try {
      const result = await templateApi.render({
        template_id: npcNoClueTemplateId,
        context: {
          npc: selectedNpc ? {
            id: selectedNpc.id, name: selectedNpc.name, age: selectedNpc.age,
            personality: selectedNpc.personality, background: selectedNpc.background,
            knowledge_scope: {
              knows: selectedNpc.knowledge_scope?.knows || [],
              does_not_know: selectedNpc.knowledge_scope?.does_not_know || [],
              world_model_limits: selectedNpc.knowledge_scope?.world_model_limits || [],
            },
          } : {},
          script: selectedScript ? {
            id: selectedScript.id, title: selectedScript.title, background: selectedScript.background,
          } : {},
          clue_guides: [],
          has_clue: false,
        },
      });
      setNpcNoClueTemplatePreview(result);
    } catch {
      message.error(t('debug.renderFailed'));
    } finally {
      setRenderingNpcNoClueTemplate(false);
    }
  }, [t, npcNoClueTemplateId, selectedNpc, selectedScript]);

  const handleScriptChange = useCallback((value: string | null) => {
    setSelectedScriptId(value);
    setSelectedNpcId(null);
    setUnlockedClueIds([]);
    setClues([]);
  }, []);

  const openFavoriteModal = useCallback(() => {
    setFavoriteName(getPresetDisplayName());
    setFavoriteModalOpen(true);
  }, [getPresetDisplayName]);

  const closeFavoriteModal = useCallback(() => {
    setFavoriteModalOpen(false);
    setFavoriteName('');
    setFavoriteNote('');
    setEditingFavoriteId(null);
  }, []);

  const handleImportFavorites = useCallback((file: File) => {
    importFavorites(
      file,
      (count) => message.success(t('debug.importSuccess', { count })),
      (error) => message.error(t('debug.importFailed') + ': ' + error)
    );
  }, [t, importFavorites]);

  return {
    // Data
    scripts,
    npcs,
    clues,
    templates,
    embeddingConfigs,
    chatConfigs,
    matchingTemplates,
    npcSystemTemplates,

    // Selections
    selectedScriptId,
    selectedNpcId,
    selectedNpc,
    selectedScript,
    selectedMatchingTemplate,
    selectedNpcClueTemplate,
    selectedNpcNoClueTemplate,
    selectedMatchingConfig,
    selectedNpcChatConfig,

    // State
    unlockedClueIds,
    setUnlockedClueIds,
    matchingStrategy,
    setMatchingStrategy,
    matchingTemplateId,
    setMatchingTemplateId,
    matchingLlmConfigId,
    setMatchingLlmConfigId,
    enableNpcReply,
    setEnableNpcReply,
    npcClueTemplateId,
    setNpcClueTemplateId,
    npcNoClueTemplateId,
    setNpcNoClueTemplateId,
    npcChatConfigId,
    setNpcChatConfigId,

    // Override options
    overrideSimilarityThreshold,
    setOverrideSimilarityThreshold,
    overrideTemperature,
    setOverrideTemperature,
    overrideMaxTokens,
    setOverrideMaxTokens,
    overrideVectorBackend,
    setOverrideVectorBackend,
    llmReturnAllScores,
    setLlmReturnAllScores,
    llmScoreThreshold,
    setLlmScoreThreshold,

    // Chat
    chatHistory,
    playerMessage,
    setPlayerMessage,
    loading,

    // Clues
    npcClues,
    lockedClues,

    // Match results
    lastMatchResults,
    lastDebugInfo,

    // Template rendering
    renderedPreviews,
    renderingClueId,
    npcClueTemplatePreview,
    npcNoClueTemplatePreview,
    renderingNpcClueTemplate,
    renderingNpcNoClueTemplate,

    // Presets
    presetHistory,
    presetFavorites,
    favoriteModalOpen,
    favoriteName,
    setFavoriteName,
    favoriteNote,
    setFavoriteNote,
    editingFavoriteId,

    // Helpers
    getNpcName,

    // Handlers
    handleScriptChange,
    setSelectedNpcId,
    handlePresetSelect,
    handleSaveToFavorites,
    handleEditFavorite,
    handleSend,
    handleClear,
    handleRenderClue,
    handleRenderNpcClueTemplate,
    handleRenderNpcNoClueTemplate,
    openFavoriteModal,
    closeFavoriteModal,
    handleImportFavorites,
    clearHistory,
    removeFromFavorites,
    exportFavorites,
  };
}
