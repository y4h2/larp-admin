import { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Select,
  Space,
  Row,
  Col,
  Tag,
  Collapse,
  Empty,
  message,
  Divider,
  Typography,
  Spin,
  Tooltip,
  Alert,
  Switch,
  Table,
  Progress,
  Tabs,
  Button,
  Slider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  LockOutlined,
  EyeOutlined,
  BulbOutlined,
  BulbFilled,
  SettingOutlined,
  AimOutlined,
} from '@ant-design/icons';
import { PageHeader, ClueTypeTag } from '@/components/common';
import { simulationApi, clueApi } from '@/api';
import { templateApi, type PromptTemplate, type TemplateRenderResponse } from '@/api/templates';
import { llmConfigApi, type LLMConfig } from '@/api/llmConfigs';
import { useScripts, useNpcs, usePresets, type PresetConfig } from '@/hooks';
import type { Clue, MatchedClue, MatchingStrategy } from '@/types';
import { v4 as uuidv4 } from 'uuid';

import { ChatPanel, StatusBar, ConfigDetails } from './components';
import { loadStoredConfig, saveConfig, type ChatMessage } from './types';

const { Option } = Select;
const { Text, Paragraph } = Typography;

const MATCHING_STRATEGIES: { value: MatchingStrategy; label: string; icon: React.ReactNode }[] = [
  { value: 'keyword', label: 'debug.keywordMatching', icon: <SearchOutlined /> },
  { value: 'embedding', label: 'debug.embeddingMatching', icon: <ThunderboltOutlined /> },
  { value: 'llm', label: 'debug.llmMatching', icon: <RobotOutlined /> },
];

export default function DialogueSimulation() {
  const { t } = useTranslation();
  const { scripts, fetchScripts } = useScripts();
  const { npcs, fetchNpcs } = useNpcs();
  const {
    history: presetHistory,
    favorites: presetFavorites,
    addToHistory,
    addToFavorites,
    updateFavorite,
    removeFromFavorites,
    clearHistory,
    getPresetById,
  } = usePresets();
  const [clues, setClues] = useState<Clue[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [embeddingConfigs, setEmbeddingConfigs] = useState<LLMConfig[]>([]);
  const [chatConfigs, setChatConfigs] = useState<LLMConfig[]>([]);

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
    storedConfig.matchingStrategy ?? 'keyword'
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
  const matchingTemplates = templates.filter((t) =>
    ['clue_embedding', 'clue_reveal', 'custom'].includes(t.type)
  );
  const npcSystemTemplates = templates.filter((t) =>
    ['npc_system_prompt', 'custom'].includes(t.type)
  );

  // Memoized selections
  const selectedMatchingTemplate = useMemo(() => {
    return templates.find((t) => t.id === matchingTemplateId) || null;
  }, [templates, matchingTemplateId]);

  const selectedNpcClueTemplate = useMemo(() => {
    return templates.find((t) => t.id === npcClueTemplateId) || null;
  }, [templates, npcClueTemplateId]);

  const selectedNpcNoClueTemplate = useMemo(() => {
    return templates.find((t) => t.id === npcNoClueTemplateId) || null;
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

  const lockedClues = useMemo(() => {
    const unlockedSet = new Set(unlockedClueIds || []);
    return clues.filter((c) => !unlockedSet.has(c.id));
  }, [clues, unlockedClueIds]);

  // Helper functions
  const getCurrentConfig = (): PresetConfig => ({
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
  });

  const getPresetDisplayName = (): string => {
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
  };

  const loadPreset = (config: PresetConfig) => {
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
    message.success(t('debug.presetLoaded'));
  };

  const handlePresetSelect = (presetId: string) => {
    const config = getPresetById(presetId);
    if (config) {
      loadPreset(config);
    }
  };

  const handleSaveToFavorites = () => {
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
  };

  const handleEditFavorite = (favorite: typeof presetFavorites[0]) => {
    setEditingFavoriteId(favorite.id);
    setFavoriteName(favorite.name);
    setFavoriteNote(favorite.note || '');
    setFavoriteModalOpen(true);
  };

  // Effects
  useEffect(() => {
    fetchScripts();
    templateApi.list({ page_size: 100 }).then((res) => setTemplates(res.items));
    llmConfigApi.list({ type: 'embedding', page_size: 100 }).then((res) => setEmbeddingConfigs(res.items));
    llmConfigApi.list({ type: 'chat', page_size: 100 }).then((res) => setChatConfigs(res.items));
  }, [fetchScripts]);

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
    });
  }, [
    selectedScriptId, selectedNpcId, matchingStrategy, matchingTemplateId, matchingLlmConfigId,
    enableNpcReply, npcClueTemplateId, npcNoClueTemplateId, npcChatConfigId,
    overrideSimilarityThreshold, overrideTemperature, overrideMaxTokens,
  ]);

  useEffect(() => {
    if (selectedScriptId) {
      fetchNpcs({ script_id: selectedScriptId });
      clueApi.list({ script_id: selectedScriptId, page_size: 100 }).then((res) => setClues(res.items));
    }
  }, [selectedScriptId, fetchNpcs]);

  useEffect(() => {
    setRenderedPreviews({});
    if (matchingTemplateId && lockedClues.length > 0 && selectedNpc) {
      const renderAllLocked = async () => {
        const previews: Record<string, TemplateRenderResponse> = {};
        for (const clue of lockedClues) {
          try {
            const result = await templateApi.render({
              template_id: matchingTemplateId,
              context: {
                clue: {
                  id: clue.id, name: clue.name, type: clue.type, detail: clue.detail,
                  detail_for_npc: clue.detail_for_npc, trigger_keywords: clue.trigger_keywords,
                  trigger_semantic_summary: clue.trigger_semantic_summary,
                },
                npc: {
                  id: selectedNpc.id, name: selectedNpc.name, age: selectedNpc.age,
                  personality: selectedNpc.personality, background: selectedNpc.background,
                },
              },
            });
            previews[clue.id] = result;
          } catch { /* Skip failed renders */ }
        }
        setRenderedPreviews(previews);
      };
      renderAllLocked();
    }
  }, [matchingTemplateId, lockedClues, selectedNpc]);

  // Handlers
  const handleSend = async () => {
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
        save_log: true,
        embedding_options_override: overrideSimilarityThreshold !== undefined
          ? { similarity_threshold: overrideSimilarityThreshold } : undefined,
        chat_options_override: (overrideTemperature !== undefined || overrideMaxTokens !== undefined)
          ? { temperature: overrideTemperature, max_tokens: overrideMaxTokens } : undefined,
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
  };

  const handleClear = () => {
    setChatHistory([]);
    setUnlockedClueIds([]);
    setLastMatchResults(null);
    setLastDebugInfo(null);
    sessionIdRef.current = uuidv4();
  };

  const handleRenderClue = async (clue: Clue) => {
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
          } : null,
        },
      });
      setRenderedPreviews((prev) => ({ ...prev, [clue.id]: result }));
    } catch {
      message.error(t('debug.renderFailed'));
    } finally {
      setRenderingClueId(null);
    }
  };

  const handleRenderNpcClueTemplate = async () => {
    if (!npcClueTemplateId) return;
    setRenderingNpcClueTemplate(true);
    try {
      const result = await templateApi.render({
        template_id: npcClueTemplateId,
        context: {
          npc: selectedNpc ? {
            id: selectedNpc.id, name: selectedNpc.name, age: selectedNpc.age,
            personality: selectedNpc.personality, background: selectedNpc.background,
            knowledge_scope: selectedNpc.knowledge_scope || {},
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
  };

  const handleRenderNpcNoClueTemplate = async () => {
    if (!npcNoClueTemplateId) return;
    setRenderingNpcNoClueTemplate(true);
    try {
      const result = await templateApi.render({
        template_id: npcNoClueTemplateId,
        context: {
          npc: selectedNpc ? {
            id: selectedNpc.id, name: selectedNpc.name, age: selectedNpc.age,
            personality: selectedNpc.personality, background: selectedNpc.background,
            knowledge_scope: selectedNpc.knowledge_scope || {},
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
  };

  // Table columns
  const matchResultColumns: ColumnsType<MatchedClue> = [
    {
      title: t('clue.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: MatchedClue) => (
        <Space>
          <span>{text}</span>
          {record.is_triggered && <Tag color="green">{t('debug.triggered')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('debug.score'),
      dataIndex: 'score',
      key: 'score',
      width: 120,
      render: (score: number) => (
        <Progress percent={Math.round(score * 100)} size="small" status={score >= 0.5 ? 'success' : 'normal'} />
      ),
    },
    {
      title: t('debug.matchDetails'),
      dataIndex: 'match_reasons',
      key: 'match_reasons',
      render: (reasons: string[]) => (
        <Space direction="vertical" size={2}>
          {reasons.map((r, i) => (
            <Text key={i} type="secondary" style={{ fontSize: 12 }}>{r}</Text>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('debug.simulation')} subtitle={t('debug.simulationSubtitle')} />

      {/* Status Bar */}
      <StatusBar
        selectedScript={selectedScript}
        selectedNpc={selectedNpc}
        matchingStrategy={matchingStrategy}
        enableNpcReply={enableNpcReply}
        npcClueTemplateId={npcClueTemplateId}
        npcNoClueTemplateId={npcNoClueTemplateId}
        npcChatConfigId={npcChatConfigId}
        presetHistory={presetHistory}
        presetFavorites={presetFavorites}
        favoriteModalOpen={favoriteModalOpen}
        favoriteName={favoriteName}
        favoriteNote={favoriteNote}
        editingFavoriteId={editingFavoriteId}
        t={t}
        onPresetSelect={handlePresetSelect}
        onClearHistory={clearHistory}
        onRemoveFavorite={removeFromFavorites}
        onEditFavorite={handleEditFavorite}
        onOpenFavoriteModal={() => {
          setFavoriteName(getPresetDisplayName());
          setFavoriteModalOpen(true);
        }}
        onCloseFavoriteModal={() => {
          setFavoriteModalOpen(false);
          setFavoriteName('');
          setFavoriteNote('');
          setEditingFavoriteId(null);
        }}
        onFavoriteNameChange={setFavoriteName}
        onFavoriteNoteChange={setFavoriteNote}
        onSaveToFavorites={handleSaveToFavorites}
      />

      <Row gutter={[16, 16]}>
        {/* Left: Configuration */}
        <Col xs={24} sm={24} md={8} lg={6} xl={6}>
          <Card title={t('debug.configuration')} size="small" bodyStyle={{ padding: '0 12px 12px' }}>
            <Tabs
              size="small"
              items={[
                {
                  key: 'basic',
                  label: <span><SettingOutlined /><span style={{ marginLeft: 4 }}>{t('debug.basicConfig')}</span></span>,
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.selectScript')}</div>
                        <Select
                          placeholder={t('debug.selectScript')}
                          value={selectedScriptId}
                          onChange={(value) => {
                            setSelectedScriptId(value);
                            setSelectedNpcId(null);
                            setUnlockedClueIds([]);
                            setClues([]);
                          }}
                          style={{ width: '100%' }}
                          allowClear
                        >
                          {scripts.map((s) => <Option key={s.id} value={s.id}>{s.title}</Option>)}
                        </Select>
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.selectNpc')}</div>
                        <Select
                          placeholder={t('debug.selectNpc')}
                          value={selectedNpcId}
                          onChange={setSelectedNpcId}
                          style={{ width: '100%' }}
                          disabled={!selectedScriptId}
                          allowClear
                        >
                          {npcs.map((n) => <Option key={n.id} value={n.id}>{n.name}</Option>)}
                        </Select>
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.unlockedClues')}</div>
                        <Select
                          mode="multiple"
                          placeholder={t('debug.unlockedCluesExtra')}
                          value={unlockedClueIds}
                          onChange={setUnlockedClueIds}
                          style={{ width: '100%' }}
                          disabled={!selectedScriptId}
                          maxTagCount={2}
                        >
                          {clues.map((c) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                        </Select>
                      </div>
                    </Space>
                  ),
                },
                {
                  key: 'matching',
                  label: <span><AimOutlined /><span style={{ marginLeft: 4 }}>{t('debug.matchingConfig')}</span></span>,
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.matchingStrategy')}</div>
                        <Select value={matchingStrategy} onChange={setMatchingStrategy} style={{ width: '100%' }}>
                          {MATCHING_STRATEGIES.map((s) => (
                            <Option key={s.value} value={s.value}>
                              <Space>{s.icon}{t(s.label)}</Space>
                            </Option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.matchingTemplate')}</div>
                        <Select
                          placeholder={t('debug.selectMatchingTemplate')}
                          value={matchingTemplateId}
                          onChange={setMatchingTemplateId}
                          style={{ width: '100%' }}
                          allowClear
                        >
                          {matchingTemplates.map((tpl) => (
                            <Option key={tpl.id} value={tpl.id}>
                              <Space>
                                <span>{tpl.name}</span>
                                <Tag color={tpl.type === 'clue_embedding' ? 'blue' : 'default'}>
                                  {t(`template.types.${tpl.type}`)}
                                </Tag>
                              </Space>
                            </Option>
                          ))}
                        </Select>
                      </div>
                      {matchingStrategy === 'embedding' && (
                        <>
                          <div>
                            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.selectEmbeddingConfig')}</div>
                            <Select
                              placeholder={t('debug.selectEmbeddingConfig')}
                              value={matchingLlmConfigId}
                              onChange={setMatchingLlmConfigId}
                              style={{ width: '100%' }}
                              allowClear
                            >
                              {embeddingConfigs.map((config) => (
                                <Option key={config.id} value={config.id}>
                                  <Space>
                                    <span>{config.name}</span>
                                    <Text type="secondary" style={{ fontSize: 12 }}>({config.model})</Text>
                                  </Space>
                                </Option>
                              ))}
                            </Select>
                            <ConfigDetails config={selectedMatchingConfig} type="embedding" t={t} />
                          </div>
                          <div>
                            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                              <Space>
                                {t('debug.similarityThreshold')}
                                {overrideSimilarityThreshold !== undefined && (
                                  <Tag color="orange" style={{ fontSize: 10 }}>{t('debug.override')}</Tag>
                                )}
                              </Space>
                            </div>
                            <Slider
                              min={0} max={1} step={0.05}
                              value={overrideSimilarityThreshold ?? 0.5}
                              onChange={(val) => setOverrideSimilarityThreshold(val)}
                              marks={{ 0: '0', 0.5: '0.5', 1: '1' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.similarityThresholdHint')}</Text>
                              {overrideSimilarityThreshold !== undefined && (
                                <Button type="link" size="small" onClick={() => setOverrideSimilarityThreshold(undefined)} style={{ padding: 0, height: 'auto', fontSize: 11 }}>
                                  {t('debug.resetToDefault')}
                                </Button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                      {matchingStrategy === 'llm' && (
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.selectChatConfig')}</div>
                          <Select
                            placeholder={t('debug.selectChatConfig')}
                            value={matchingLlmConfigId}
                            onChange={setMatchingLlmConfigId}
                            style={{ width: '100%' }}
                            allowClear
                          >
                            {chatConfigs.map((config) => (
                              <Option key={config.id} value={config.id}>
                                <Space>
                                  <span>{config.name}</span>
                                  <Text type="secondary" style={{ fontSize: 12 }}>({config.model})</Text>
                                </Space>
                              </Option>
                            ))}
                          </Select>
                          <ConfigDetails config={selectedMatchingConfig} type="chat" t={t} />
                        </div>
                      )}
                    </Space>
                  ),
                },
                {
                  key: 'npc',
                  label: (
                    <span>
                      <RobotOutlined />
                      <span style={{ marginLeft: 4 }}>{t('debug.npcReply')}</span>
                      {enableNpcReply && <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>ON</Tag>}
                    </span>
                  ),
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                      <div style={{ padding: '8px 12px', background: enableNpcReply ? '#f6ffed' : '#fafafa', borderRadius: 6, border: enableNpcReply ? '1px solid #b7eb8f' : '1px solid #d9d9d9' }}>
                        <Space>
                          <Switch checked={enableNpcReply} onChange={setEnableNpcReply} size="small" />
                          <Text type={enableNpcReply ? undefined : 'secondary'}>{t('debug.enableNpcReply')}</Text>
                        </Space>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.enableNpcReplyHint')}</Text>
                        </div>
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                          <BulbFilled style={{ color: '#52c41a', marginRight: 4 }} />{t('debug.npcClueTemplate')}
                        </div>
                        <Select placeholder={t('debug.selectNpcClueTemplate')} value={npcClueTemplateId} onChange={setNpcClueTemplateId} style={{ width: '100%' }} allowClear disabled={!enableNpcReply}>
                          {npcSystemTemplates.map((tpl) => (
                            <Option key={tpl.id} value={tpl.id}>
                              <Space><span>{tpl.name}</span><Tag color={tpl.type === 'npc_system_prompt' ? 'purple' : 'default'}>{t(`template.types.${tpl.type}`)}</Tag></Space>
                            </Option>
                          ))}
                        </Select>
                        <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.npcClueTemplateHint')}</Text>
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                          <BulbOutlined style={{ color: '#faad14', marginRight: 4 }} />{t('debug.npcNoClueTemplate')}
                        </div>
                        <Select placeholder={t('debug.selectNpcNoClueTemplate')} value={npcNoClueTemplateId} onChange={setNpcNoClueTemplateId} style={{ width: '100%' }} allowClear disabled={!enableNpcReply}>
                          {npcSystemTemplates.map((tpl) => (
                            <Option key={tpl.id} value={tpl.id}>
                              <Space><span>{tpl.name}</span><Tag color={tpl.type === 'npc_system_prompt' ? 'purple' : 'default'}>{t(`template.types.${tpl.type}`)}</Tag></Space>
                            </Option>
                          ))}
                        </Select>
                        <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.npcNoClueTemplateHint')}</Text>
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('debug.npcChatModel')}</div>
                        <Select placeholder={t('debug.selectNpcChatModel')} value={npcChatConfigId} onChange={setNpcChatConfigId} style={{ width: '100%' }} allowClear disabled={!enableNpcReply}>
                          {chatConfigs.map((config) => (
                            <Option key={config.id} value={config.id}>
                              <Space><span>{config.name}</span><Text type="secondary" style={{ fontSize: 12 }}>({config.model})</Text></Space>
                            </Option>
                          ))}
                        </Select>
                        {enableNpcReply && <ConfigDetails config={selectedNpcChatConfig} type="chat" t={t} />}
                      </div>
                      {enableNpcReply && npcChatConfigId && (
                        <>
                          <div>
                            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                              <Space>{t('debug.temperature')}{overrideTemperature !== undefined && <Tag color="orange" style={{ fontSize: 10 }}>{t('debug.override')}</Tag>}</Space>
                            </div>
                            <Slider min={0} max={2} step={0.1} value={overrideTemperature ?? 0.7} onChange={(val) => setOverrideTemperature(val)} marks={{ 0: '0', 0.7: '0.7', 1: '1', 2: '2' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.temperatureHint')}</Text>
                              {overrideTemperature !== undefined && <Button type="link" size="small" onClick={() => setOverrideTemperature(undefined)} style={{ padding: 0, height: 'auto', fontSize: 11 }}>{t('debug.resetToDefault')}</Button>}
                            </div>
                          </div>
                          <div>
                            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                              <Space>{t('debug.maxTokens')}{overrideMaxTokens !== undefined && <Tag color="orange" style={{ fontSize: 10 }}>{t('debug.override')}</Tag>}</Space>
                            </div>
                            <Slider min={100} max={8000} step={100} value={overrideMaxTokens ?? 2000} onChange={(val) => setOverrideMaxTokens(val)} marks={{ 100: '100', 2000: '2k', 4000: '4k', 8000: '8k' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>{t('debug.maxTokensHint')}</Text>
                              {overrideMaxTokens !== undefined && <Button type="link" size="small" onClick={() => setOverrideMaxTokens(undefined)} style={{ padding: 0, height: 'auto', fontSize: 11 }}>{t('debug.resetToDefault')}</Button>}
                            </div>
                          </div>
                        </>
                      )}
                      {enableNpcReply && ((!npcClueTemplateId && !npcNoClueTemplateId) || !npcChatConfigId) && (
                        <Alert type="warning" message={t('debug.npcReplyConfigWarning')} showIcon style={{ fontSize: 12 }} />
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* Middle: Match Results + Templates + Locked Clues */}
        <Col xs={24} sm={24} md={16} lg={10} xl={10}>
          {lastMatchResults && lastMatchResults.length > 0 && (
            <Card title={t('debug.matchResults')} size="small" style={{ marginBottom: 16 }}>
              {lastDebugInfo && (
                <Alert
                  message={t('debug.debugSummary')}
                  description={
                    <Space direction="vertical" size={0}>
                      <Text>{t('debug.totalCandidates')}: {String(lastDebugInfo.total_candidates ?? 0)}</Text>
                      <Text>{t('debug.totalMatched')}: {String(lastDebugInfo.total_matched ?? 0)}</Text>
                      <Text>{t('debug.totalTriggered')}: {String(lastDebugInfo.total_triggered ?? 0)}</Text>
                      <Text>{t('debug.strategy')}: {t(`debug.${String(lastDebugInfo.strategy ?? 'keyword')}Matching`)}</Text>
                    </Space>
                  }
                  type="info"
                  style={{ marginBottom: 12 }}
                />
              )}
              <Table columns={matchResultColumns} dataSource={lastMatchResults} rowKey="clue_id" size="small" pagination={false} scroll={{ y: 200 }} />
            </Card>
          )}

          {selectedMatchingTemplate && (
            <Card title={t('debug.templateContent')} size="small" style={{ marginBottom: 16 }}>
              <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 200, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', border: '1px solid #d9d9d9' }}>
                {selectedMatchingTemplate.content}
              </div>
              {selectedMatchingTemplate.variables && selectedMatchingTemplate.variables.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('template.detectedVariables')}:</Text>
                  <div style={{ marginTop: 4 }}>
                    {selectedMatchingTemplate.variables.map((v, i) => <Tag key={i} color="blue" style={{ marginBottom: 4 }}>{v}</Tag>)}
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card
            title={<Space><LockOutlined />{t('debug.lockedClues')}<Tag>{lockedClues.length}</Tag></Space>}
            size="small"
          >
            {lockedClues.length === 0 ? (
              <Empty description={t('debug.noLockedClues')} />
            ) : (
              <Collapse
                size="small"
                items={lockedClues.map((clue) => ({
                  key: clue.id,
                  label: (
                    <Space>
                      <ClueTypeTag type={clue.type} />
                      <span>{clue.name}</span>
                      {renderedPreviews[clue.id] && <Tag color="green" style={{ marginLeft: 8 }}>{t('debug.rendered')}</Tag>}
                    </Space>
                  ),
                  extra: matchingTemplateId && (
                    <Tooltip title={t('debug.renderPreview')}>
                      <Button
                        size="small"
                        type="text"
                        icon={renderingClueId === clue.id ? <Spin size="small" /> : <EyeOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleRenderClue(clue); }}
                        disabled={renderingClueId !== null}
                      />
                    </Tooltip>
                  ),
                  children: (
                    <div>
                      <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{t('clue.detail')}:</Text>
                        <Paragraph style={{ margin: '4px 0', fontSize: 13 }} ellipsis={{ rows: 2, expandable: true }}>{clue.detail}</Paragraph>
                      </div>
                      {clue.trigger_keywords && clue.trigger_keywords.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>{t('clue.triggerKeywords')}:</Text>
                          <div style={{ marginTop: 4 }}>{clue.trigger_keywords.map((kw, i) => <Tag key={i} style={{ marginBottom: 4 }}>{kw}</Tag>)}</div>
                        </div>
                      )}
                      {renderedPreviews[clue.id] && (
                        <div style={{ marginTop: 12 }}>
                          <Divider style={{ margin: '8px 0' }} />
                          <Text strong style={{ color: '#1890ff', fontSize: 12 }}>{t('debug.renderedResult')}:</Text>
                          <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 6, marginTop: 8, border: '1px solid #91d5ff', whiteSpace: 'pre-wrap', fontSize: 13, maxHeight: 150, overflow: 'auto' }}>
                            {renderedPreviews[clue.id].rendered_content || t('template.emptyResult')}
                          </div>
                          {renderedPreviews[clue.id].warnings.length > 0 && (
                            <Alert type="warning" message={t('template.renderWarnings')} description={renderedPreviews[clue.id].warnings.join(', ')} style={{ marginTop: 8, fontSize: 12 }} />
                          )}
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            )}
          </Card>

          {/* NPC Template Previews */}
          {selectedNpcClueTemplate && enableNpcReply && (
            <Card
              title={<Space><RobotOutlined />{t('debug.npcClueTemplatePreview')}</Space>}
              size="small"
              style={{ marginTop: 16 }}
              extra={<Button size="small" icon={renderingNpcClueTemplate ? <Spin size="small" /> : <EyeOutlined />} onClick={handleRenderNpcClueTemplate} disabled={renderingNpcClueTemplate || !selectedNpc}>{t('template.render')}</Button>}
            >
              <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 150, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', border: '1px solid #d9d9d9' }}>
                {selectedNpcClueTemplate.content}
              </div>
              {selectedNpcClueTemplate.variables && selectedNpcClueTemplate.variables.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('template.detectedVariables')}:</Text>
                  <div style={{ marginTop: 4 }}>{selectedNpcClueTemplate.variables.map((v, i) => <Tag key={i} color="purple" style={{ marginBottom: 4 }}>{v}</Tag>)}</div>
                </div>
              )}
              {npcClueTemplatePreview && (
                <div style={{ marginTop: 12 }}>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text strong style={{ color: '#722ed1', fontSize: 12 }}>{t('debug.renderedResult')}:</Text>
                  <div style={{ background: '#f9f0ff', padding: 12, borderRadius: 6, marginTop: 8, border: '1px solid #d3adf7', whiteSpace: 'pre-wrap', fontSize: 13, maxHeight: 200, overflow: 'auto' }}>
                    {npcClueTemplatePreview.rendered_content || t('template.emptyResult')}
                  </div>
                  {npcClueTemplatePreview.warnings.length > 0 && <Alert type="warning" message={t('template.renderWarnings')} description={npcClueTemplatePreview.warnings.join(', ')} style={{ marginTop: 8, fontSize: 12 }} />}
                </div>
              )}
            </Card>
          )}

          {selectedNpcNoClueTemplate && enableNpcReply && (
            <Card
              title={<Space><RobotOutlined />{t('debug.npcNoClueTemplatePreview')}</Space>}
              size="small"
              style={{ marginTop: 16 }}
              extra={<Button size="small" icon={renderingNpcNoClueTemplate ? <Spin size="small" /> : <EyeOutlined />} onClick={handleRenderNpcNoClueTemplate} disabled={renderingNpcNoClueTemplate || !selectedNpc}>{t('template.render')}</Button>}
            >
              <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 150, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', border: '1px solid #d9d9d9' }}>
                {selectedNpcNoClueTemplate.content}
              </div>
              {selectedNpcNoClueTemplate.variables && selectedNpcNoClueTemplate.variables.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('template.detectedVariables')}:</Text>
                  <div style={{ marginTop: 4 }}>{selectedNpcNoClueTemplate.variables.map((v, i) => <Tag key={i} color="orange" style={{ marginBottom: 4 }}>{v}</Tag>)}</div>
                </div>
              )}
              {npcNoClueTemplatePreview && (
                <div style={{ marginTop: 12 }}>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text strong style={{ color: '#fa8c16', fontSize: 12 }}>{t('debug.renderedResult')}:</Text>
                  <div style={{ background: '#fff7e6', padding: 12, borderRadius: 6, marginTop: 8, border: '1px solid #ffd591', whiteSpace: 'pre-wrap', fontSize: 13, maxHeight: 200, overflow: 'auto' }}>
                    {npcNoClueTemplatePreview.rendered_content || t('template.emptyResult')}
                  </div>
                  {npcNoClueTemplatePreview.warnings.length > 0 && <Alert type="warning" message={t('template.renderWarnings')} description={npcNoClueTemplatePreview.warnings.join(', ')} style={{ marginTop: 8, fontSize: 12 }} />}
                </div>
              )}
            </Card>
          )}
        </Col>

        {/* Right: Chat */}
        <Col xs={24} sm={24} md={24} lg={8} xl={8}>
          <ChatPanel
            chatHistory={chatHistory}
            playerMessage={playerMessage}
            loading={loading}
            canSend={!!selectedScriptId && !!selectedNpcId}
            t={t}
            onMessageChange={setPlayerMessage}
            onSend={handleSend}
            onClear={handleClear}
          />
        </Col>
      </Row>
    </div>
  );
}
