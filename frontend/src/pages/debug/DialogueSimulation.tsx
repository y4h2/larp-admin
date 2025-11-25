import { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Select,
  Input,
  Button,
  Space,
  Row,
  Col,
  Tag,
  Descriptions,
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
  Modal,
  Dropdown,
  Slider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SendOutlined,
  ClearOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  LockOutlined,
  EyeOutlined,
  BulbOutlined,
  BulbFilled,
  SettingOutlined,
  AimOutlined,
  HistoryOutlined,
  StarOutlined,
  StarFilled,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { PageHeader, ClueTypeTag } from '@/components/common';
import { simulationApi, clueApi } from '@/api';
import { templateApi, type PromptTemplate, type TemplateRenderResponse } from '@/api/templates';
import { llmConfigApi, type LLMConfig } from '@/api/llmConfigs';
import { useScripts, useNpcs, usePresets, type PresetConfig } from '@/hooks';
import type { Clue, SimulationResult, MatchedClue, MatchingStrategy } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Paragraph } = Typography;

// LocalStorage key for persisting configuration
const STORAGE_KEY = 'dialogue-simulation-config';

interface StoredConfig {
  selectedScriptId: string | null;
  selectedNpcId: string | null;
  matchingStrategy: MatchingStrategy;
  matchingTemplateId: string | undefined;
  matchingLlmConfigId: string | undefined;
  enableNpcReply: boolean;
  npcClueTemplateId: string | undefined;
  npcNoClueTemplateId: string | undefined;
  npcChatConfigId: string | undefined;
  // Runtime override options
  overrideSimilarityThreshold: number | undefined;
  overrideTemperature: number | undefined;
}

const loadStoredConfig = (): Partial<StoredConfig> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
};

const saveConfig = (config: StoredConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
};

const MATCHING_STRATEGIES: { value: MatchingStrategy; label: string; icon: React.ReactNode }[] = [
  { value: 'keyword', label: 'debug.keywordMatching', icon: <SearchOutlined /> },
  { value: 'embedding', label: 'debug.embeddingMatching', icon: <ThunderboltOutlined /> },
  { value: 'llm', label: 'debug.llmMatching', icon: <RobotOutlined /> },
];

interface ChatMessage {
  role: 'player' | 'system' | 'npc';
  content: string;
  result?: SimulationResult;
  // For NPC messages: indicates if clues were triggered
  hasTriggeredClues?: boolean;
  triggeredClueCount?: number;
}

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

  // Session tracking - generate new session ID on mount and when cleared
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
  const [enableNpcReply, setEnableNpcReply] = useState(
    storedConfig.enableNpcReply ?? false
  );
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

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [playerMessage, setPlayerMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Favorite modal state
  const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [favoriteName, setFavoriteName] = useState('');
  const [favoriteNote, setFavoriteNote] = useState('');
  const [editingFavoriteId, setEditingFavoriteId] = useState<string | null>(null);

  // Match results for table display
  const [lastMatchResults, setLastMatchResults] = useState<MatchedClue[] | null>(null);
  const [lastDebugInfo, setLastDebugInfo] = useState<Record<string, unknown> | null>(null);

  // Template rendering
  const [renderedPreviews, setRenderedPreviews] = useState<Record<string, TemplateRenderResponse>>({});
  const [renderingClueId, setRenderingClueId] = useState<string | null>(null);

  // NPC template previews (for both clue and no-clue templates)
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

  // Get selected template objects
  const selectedMatchingTemplate = useMemo(() => {
    return templates.find((t) => t.id === matchingTemplateId) || null;
  }, [templates, matchingTemplateId]);

  const selectedNpcClueTemplate = useMemo(() => {
    return templates.find((t) => t.id === npcClueTemplateId) || null;
  }, [templates, npcClueTemplateId]);

  const selectedNpcNoClueTemplate = useMemo(() => {
    return templates.find((t) => t.id === npcNoClueTemplateId) || null;
  }, [templates, npcNoClueTemplateId]);

  // Get selected NPC object
  const selectedNpc = useMemo(() => {
    return npcs.find((n) => n.id === selectedNpcId) || null;
  }, [npcs, selectedNpcId]);

  // Get selected Script object
  const selectedScript = useMemo(() => {
    return scripts.find((s) => s.id === selectedScriptId) || null;
  }, [scripts, selectedScriptId]);

  // Compute locked clues (clues not in unlocked list)
  const lockedClues = useMemo(() => {
    const unlockedSet = new Set(unlockedClueIds || []);
    return clues.filter((c) => !unlockedSet.has(c.id));
  }, [clues, unlockedClueIds]);

  // Get current config as PresetConfig
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
  });

  // Generate display name for preset
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

  // Load preset config
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
    message.success(t('debug.presetLoaded'));
  };

  // Handle preset selection from dropdown
  const handlePresetSelect = (presetId: string) => {
    const config = getPresetById(presetId);
    if (config) {
      loadPreset(config);
    }
  };

  // Save current config to favorites (or update existing)
  const handleSaveToFavorites = () => {
    if (!favoriteName.trim()) {
      message.warning(t('debug.enterPresetName'));
      return;
    }

    if (editingFavoriteId) {
      // Editing existing favorite
      updateFavorite(editingFavoriteId, {
        name: favoriteName.trim(),
        note: favoriteNote.trim() || undefined,
      });
      message.success(t('debug.presetUpdated'));
    } else {
      // Creating new favorite
      addToFavorites(getCurrentConfig(), favoriteName.trim(), favoriteNote.trim() || undefined);
      message.success(t('debug.presetSaved'));
    }

    setFavoriteModalOpen(false);
    setFavoriteName('');
    setFavoriteNote('');
    setEditingFavoriteId(null);
  };

  // Open edit modal for existing favorite
  const handleEditFavorite = (favorite: typeof presetFavorites[0]) => {
    setEditingFavoriteId(favorite.id);
    setFavoriteName(favorite.name);
    setFavoriteNote(favorite.note || '');
    setFavoriteModalOpen(true);
  };

  useEffect(() => {
    fetchScripts();
    // Fetch all templates
    templateApi.list({ page_size: 100 }).then((res) => {
      setTemplates(res.items);
    });
    // Fetch LLM configs
    llmConfigApi.list({ type: 'embedding', page_size: 100 }).then((res) => {
      setEmbeddingConfigs(res.items);
    });
    llmConfigApi.list({ type: 'chat', page_size: 100 }).then((res) => {
      setChatConfigs(res.items);
    });
  }, [fetchScripts]);

  // Save configuration to localStorage whenever it changes
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
    });
  }, [
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
  ]);

  useEffect(() => {
    if (selectedScriptId) {
      fetchNpcs({ script_id: selectedScriptId });
      clueApi.list({ script_id: selectedScriptId, page_size: 100 }).then((res) => {
        setClues(res.items);
      });
    }
  }, [selectedScriptId, fetchNpcs]);

  // Auto-render all locked clues when matching template or locked clues change
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
                  id: clue.id,
                  name: clue.name,
                  type: clue.type,
                  detail: clue.detail,
                  detail_for_npc: clue.detail_for_npc,
                  trigger_keywords: clue.trigger_keywords,
                  trigger_semantic_summary: clue.trigger_semantic_summary,
                },
                npc: {
                  id: selectedNpc.id,
                  name: selectedNpc.name,
                  age: selectedNpc.age,
                  personality: selectedNpc.personality,
                  background: selectedNpc.background,
                },
              },
            });
            previews[clue.id] = result;
          } catch {
            // Skip failed renders silently
          }
        }
        setRenderedPreviews(previews);
      };
      renderAllLocked();
    }
  }, [matchingTemplateId, lockedClues, selectedNpc]);

  const handleSend = async () => {
    if (!selectedScriptId || !selectedNpcId || !playerMessage.trim()) {
      message.warning(t('debug.fillAllFields'));
      return;
    }

    // Auto-save to history on send
    addToHistory(getCurrentConfig(), getPresetDisplayName());

    const newPlayerMessage: ChatMessage = {
      role: 'player',
      content: playerMessage,
    };
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
        // Only include NPC reply options if enabled
        npc_clue_template_id: enableNpcReply ? npcClueTemplateId : undefined,
        npc_no_clue_template_id: enableNpcReply ? npcNoClueTemplateId : undefined,
        npc_chat_config_id: enableNpcReply ? npcChatConfigId : undefined,
        session_id: sessionIdRef.current,
        save_log: true,
        // Runtime override options
        embedding_options_override: overrideSimilarityThreshold !== undefined
          ? { similarity_threshold: overrideSimilarityThreshold }
          : undefined,
        chat_options_override: overrideTemperature !== undefined
          ? { temperature: overrideTemperature }
          : undefined,
      });

      // Store match results for table display
      setLastMatchResults(result.matched_clues);
      setLastDebugInfo(result.debug_info);

      // Add system message with match details
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `${t('debug.cluesTriggered', { count: result.triggered_clues.length })}`,
        result,
      };
      setChatHistory((prev) => [...prev, systemMessage]);

      // Add NPC response if available and enabled
      if (enableNpcReply && result.npc_response) {
        const triggeredCount = result.triggered_clues.length;
        const npcMessage: ChatMessage = {
          role: 'npc',
          content: result.npc_response,
          hasTriggeredClues: triggeredCount > 0,
          triggeredClueCount: triggeredCount,
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
    // Generate new session ID for next conversation
    sessionIdRef.current = uuidv4();
  };

  // Match results table columns
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
        <Progress
          percent={Math.round(score * 100)}
          size="small"
          status={score >= 0.5 ? 'success' : 'normal'}
        />
      ),
    },
    {
      title: t('debug.matchDetails'),
      dataIndex: 'match_reasons',
      key: 'match_reasons',
      render: (reasons: string[]) => (
        <Space direction="vertical" size={2}>
          {reasons.map((r, i) => (
            <Text key={i} type="secondary" style={{ fontSize: 12 }}>
              {r}
            </Text>
          ))}
        </Space>
      ),
    },
  ];

  // Render template for a specific clue
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
            id: clue.id,
            name: clue.name,
            type: clue.type,
            detail: clue.detail,
            detail_for_npc: clue.detail_for_npc,
            trigger_keywords: clue.trigger_keywords,
            trigger_semantic_summary: clue.trigger_semantic_summary,
          },
          npc: selectedNpc ? {
            id: selectedNpc.id,
            name: selectedNpc.name,
            age: selectedNpc.age,
            personality: selectedNpc.personality,
            background: selectedNpc.background,
          } : null,
        },
      });
      setRenderedPreviews((prev) => ({
        ...prev,
        [clue.id]: result,
      }));
    } catch {
      message.error(t('debug.renderFailed'));
    } finally {
      setRenderingClueId(null);
    }
  };

  // Render NPC clue template preview
  const handleRenderNpcClueTemplate = async () => {
    if (!npcClueTemplateId) {
      message.warning(t('debug.selectTemplateFirst'));
      return;
    }

    setRenderingNpcClueTemplate(true);
    try {
      const result = await templateApi.render({
        template_id: npcClueTemplateId,
        context: {
          npc: selectedNpc ? {
            id: selectedNpc.id,
            name: selectedNpc.name,
            age: selectedNpc.age,
            personality: selectedNpc.personality,
            background: selectedNpc.background,
            knowledge_scope: selectedNpc.knowledge_scope || {},
          } : {},
          script: selectedScript ? {
            id: selectedScript.id,
            title: selectedScript.title,
            background: selectedScript.background,
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

  // Render NPC no-clue template preview
  const handleRenderNpcNoClueTemplate = async () => {
    if (!npcNoClueTemplateId) {
      message.warning(t('debug.selectTemplateFirst'));
      return;
    }

    setRenderingNpcNoClueTemplate(true);
    try {
      const result = await templateApi.render({
        template_id: npcNoClueTemplateId,
        context: {
          npc: selectedNpc ? {
            id: selectedNpc.id,
            name: selectedNpc.name,
            age: selectedNpc.age,
            personality: selectedNpc.personality,
            background: selectedNpc.background,
            knowledge_scope: selectedNpc.knowledge_scope || {},
          } : {},
          script: selectedScript ? {
            id: selectedScript.id,
            title: selectedScript.title,
            background: selectedScript.background,
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

  // Format relative time for presets
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('debug.justNow');
    if (minutes < 60) return t('debug.minutesAgo', { count: minutes });
    if (hours < 24) return t('debug.hoursAgo', { count: hours });
    return t('debug.daysAgo', { count: days });
  };

  // Preset dropdown menu items
  const presetDropdownItems = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = [];

    // Favorites section
    if (presetFavorites.length > 0) {
      items.push({
        key: 'favorites-group',
        type: 'group',
        label: (
          <Space>
            <StarFilled style={{ color: '#faad14' }} />
            <span>{t('debug.favorites')}</span>
          </Space>
        ),
        children: presetFavorites.map((f) => ({
          key: f.id,
          label: (
            <div style={{ minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{f.name}</span>
                <Space size={0}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditFavorite(f);
                    }}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromFavorites(f.id);
                    }}
                  />
                </Space>
              </div>
              {f.note && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                  {f.note}
                </Text>
              )}
            </div>
          ),
        })),
      });
    }

    // History section
    if (presetHistory.length > 0) {
      if (presetFavorites.length > 0) {
        items.push({ key: 'divider-1', type: 'divider' });
      }
      items.push({
        key: 'history-group',
        type: 'group',
        label: (
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <HistoryOutlined />
              <span>{t('debug.recentHistory')}</span>
            </Space>
            {presetHistory.length > 0 && (
              <Button
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  clearHistory();
                }}
                style={{ padding: 0, height: 'auto' }}
              >
                {t('debug.clear')}
              </Button>
            )}
          </Space>
        ),
        children: presetHistory.map((h) => ({
          key: h.id,
          label: (
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              <Text ellipsis style={{ maxWidth: 200 }}>{h.name}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {formatRelativeTime(h.createdAt)}
              </Text>
            </Space>
          ),
        })),
      });
    }

    return items;
  }, [presetFavorites, presetHistory, t, removeFromFavorites, clearHistory, handleEditFavorite]);

  // Configuration status for status bar
  const configStatus = useMemo(() => {
    const items: { icon: React.ReactNode; label: string; value: string | null; color?: string }[] = [];

    // Script
    items.push({
      icon: '📜',
      label: t('debug.selectScript'),
      value: selectedScript?.title || null,
    });

    // NPC
    items.push({
      icon: '👤',
      label: t('debug.selectNpc'),
      value: selectedNpc?.name || null,
    });

    // Matching strategy
    const strategyLabels: Record<MatchingStrategy, string> = {
      keyword: t('debug.keywordMatching'),
      embedding: t('debug.embeddingMatching'),
      llm: t('debug.llmMatching'),
    };
    items.push({
      icon: '🎯',
      label: t('debug.matchingStrategy'),
      value: strategyLabels[matchingStrategy],
    });

    // NPC Reply status
    if (enableNpcReply) {
      const hasConfig = (npcClueTemplateId || npcNoClueTemplateId) && npcChatConfigId;
      items.push({
        icon: '🤖',
        label: t('debug.npcReplyConfig'),
        value: hasConfig ? t('debug.npcReplyEnabled') : t('debug.npcReplyIncomplete'),
        color: hasConfig ? 'green' : 'orange',
      });
    }

    return items;
  }, [selectedScript, selectedNpc, matchingStrategy, enableNpcReply, npcClueTemplateId, npcNoClueTemplateId, npcChatConfigId, t]);

  return (
    <div>
      <PageHeader
        title={t('debug.simulation')}
        subtitle={t('debug.simulationSubtitle')}
      />

      {/* Configuration Status Bar */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: '8px 16px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space split={<Divider type="vertical" />} wrap>
            {configStatus.map((item, index) => (
              <Space key={index} size={4}>
                <span>{item.icon}</span>
                <Text type="secondary" style={{ fontSize: 12 }}>{item.label}:</Text>
                {item.value ? (
                  <Tag color={item.color || 'blue'} style={{ margin: 0 }}>
                    {item.value}
                  </Tag>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                    {t('debug.notConfigured')}
                  </Text>
                )}
              </Space>
            ))}
          </Space>

          {/* Preset controls */}
          <Space>
            <Dropdown
              menu={{
                items: presetDropdownItems.length > 0 ? presetDropdownItems : [
                  { key: 'empty', label: t('debug.noPresets'), disabled: true }
                ],
                onClick: ({ key }) => {
                  if (key !== 'empty' && !key.startsWith('divider') && !key.endsWith('-group')) {
                    handlePresetSelect(key);
                  }
                },
              }}
              trigger={['click']}
              disabled={presetDropdownItems.length === 0}
            >
              <Button size="small" icon={<HistoryOutlined />}>
                {t('debug.presets')}
                <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
              </Button>
            </Dropdown>
            <Tooltip title={t('debug.saveToFavorites')}>
              <Button
                size="small"
                icon={<StarOutlined />}
                onClick={() => {
                  setFavoriteName(getPresetDisplayName());
                  setFavoriteModalOpen(true);
                }}
                disabled={!selectedScriptId || !selectedNpcId}
              />
            </Tooltip>
          </Space>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        {/* Left: Configuration */}
        <Col xs={24} sm={24} md={8} lg={6} xl={6}>
          <Card
            title={t('debug.configuration')}
            size="small"
            bodyStyle={{ padding: '0 12px 12px' }}
          >
            <Tabs
              size="small"
              items={[
                {
                  key: 'basic',
                  label: (
                    <span>
                      <SettingOutlined />
                      <span style={{ marginLeft: 4 }}>{t('debug.basicConfig')}</span>
                    </span>
                  ),
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                          {t('debug.selectScript')}
                        </div>
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
                          {scripts.map((s) => (
                            <Option key={s.id} value={s.id}>
                              {s.title}
                            </Option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                          {t('debug.selectNpc')}
                        </div>
                        <Select
                          placeholder={t('debug.selectNpc')}
                          value={selectedNpcId}
                          onChange={setSelectedNpcId}
                          style={{ width: '100%' }}
                          disabled={!selectedScriptId}
                          allowClear
                        >
                          {npcs.map((n) => (
                            <Option key={n.id} value={n.id}>
                              {n.name}
                            </Option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                          {t('debug.unlockedClues')}
                        </div>
                        <Select
                          mode="multiple"
                          placeholder={t('debug.unlockedCluesExtra')}
                          value={unlockedClueIds}
                          onChange={setUnlockedClueIds}
                          style={{ width: '100%' }}
                          disabled={!selectedScriptId}
                          maxTagCount={2}
                        >
                          {clues.map((c) => (
                            <Option key={c.id} value={c.id}>
                              {c.name}
                            </Option>
                          ))}
                        </Select>
                      </div>
                    </Space>
                  ),
                },
                {
                  key: 'matching',
                  label: (
                    <span>
                      <AimOutlined />
                      <span style={{ marginLeft: 4 }}>{t('debug.matchingConfig')}</span>
                    </span>
                  ),
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                          {t('debug.matchingStrategy')}
                        </div>
                        <Select
                          value={matchingStrategy}
                          onChange={setMatchingStrategy}
                          style={{ width: '100%' }}
                        >
                          {MATCHING_STRATEGIES.map((s) => (
                            <Option key={s.value} value={s.value}>
                              <Space>
                                {s.icon}
                                {t(s.label)}
                              </Space>
                            </Option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                          {t('debug.matchingTemplate')}
                        </div>
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
                            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                              {t('debug.selectEmbeddingConfig')}
                            </div>
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
                              min={0}
                              max={1}
                              step={0.05}
                              value={overrideSimilarityThreshold ?? 0.5}
                              onChange={(val) => setOverrideSimilarityThreshold(val)}
                              marks={{ 0: '0', 0.5: '0.5', 1: '1' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {t('debug.similarityThresholdHint')}
                              </Text>
                              {overrideSimilarityThreshold !== undefined && (
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => setOverrideSimilarityThreshold(undefined)}
                                  style={{ padding: 0, height: 'auto', fontSize: 11 }}
                                >
                                  {t('debug.resetToDefault')}
                                </Button>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {matchingStrategy === 'llm' && (
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                            {t('debug.selectChatConfig')}
                          </div>
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
                      {enableNpcReply && (
                        <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>ON</Tag>
                      )}
                    </span>
                  ),
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                      <div
                        style={{
                          padding: '8px 12px',
                          background: enableNpcReply ? '#f6ffed' : '#fafafa',
                          borderRadius: 6,
                          border: enableNpcReply ? '1px solid #b7eb8f' : '1px solid #d9d9d9',
                        }}
                      >
                        <Space>
                          <Switch
                            checked={enableNpcReply}
                            onChange={setEnableNpcReply}
                            size="small"
                          />
                          <Text type={enableNpcReply ? undefined : 'secondary'}>
                            {t('debug.enableNpcReply')}
                          </Text>
                        </Space>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {t('debug.enableNpcReplyHint')}
                          </Text>
                        </div>
                      </div>

                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                          <BulbFilled style={{ color: '#52c41a', marginRight: 4 }} />
                          {t('debug.npcClueTemplate')}
                        </div>
                        <Select
                          placeholder={t('debug.selectNpcClueTemplate')}
                          value={npcClueTemplateId}
                          onChange={setNpcClueTemplateId}
                          style={{ width: '100%' }}
                          allowClear
                          disabled={!enableNpcReply}
                        >
                          {npcSystemTemplates.map((tpl) => (
                            <Option key={tpl.id} value={tpl.id}>
                              <Space>
                                <span>{tpl.name}</span>
                                <Tag color={tpl.type === 'npc_system_prompt' ? 'purple' : 'default'}>
                                  {t(`template.types.${tpl.type}`)}
                                </Tag>
                              </Space>
                            </Option>
                          ))}
                        </Select>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {t('debug.npcClueTemplateHint')}
                        </Text>
                      </div>

                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                          <BulbOutlined style={{ color: '#faad14', marginRight: 4 }} />
                          {t('debug.npcNoClueTemplate')}
                        </div>
                        <Select
                          placeholder={t('debug.selectNpcNoClueTemplate')}
                          value={npcNoClueTemplateId}
                          onChange={setNpcNoClueTemplateId}
                          style={{ width: '100%' }}
                          allowClear
                          disabled={!enableNpcReply}
                        >
                          {npcSystemTemplates.map((tpl) => (
                            <Option key={tpl.id} value={tpl.id}>
                              <Space>
                                <span>{tpl.name}</span>
                                <Tag color={tpl.type === 'npc_system_prompt' ? 'purple' : 'default'}>
                                  {t(`template.types.${tpl.type}`)}
                                </Tag>
                              </Space>
                            </Option>
                          ))}
                        </Select>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {t('debug.npcNoClueTemplateHint')}
                        </Text>
                      </div>

                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                          {t('debug.npcChatModel')}
                        </div>
                        <Select
                          placeholder={t('debug.selectNpcChatModel')}
                          value={npcChatConfigId}
                          onChange={setNpcChatConfigId}
                          style={{ width: '100%' }}
                          allowClear
                          disabled={!enableNpcReply}
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
                      </div>

                      {enableNpcReply && npcChatConfigId && (
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                            <Space>
                              {t('debug.temperature')}
                              {overrideTemperature !== undefined && (
                                <Tag color="orange" style={{ fontSize: 10 }}>{t('debug.override')}</Tag>
                              )}
                            </Space>
                          </div>
                          <Slider
                            min={0}
                            max={2}
                            step={0.1}
                            value={overrideTemperature ?? 0.7}
                            onChange={(val) => setOverrideTemperature(val)}
                            marks={{ 0: '0', 0.7: '0.7', 1: '1', 2: '2' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {t('debug.temperatureHint')}
                            </Text>
                            {overrideTemperature !== undefined && (
                              <Button
                                type="link"
                                size="small"
                                onClick={() => setOverrideTemperature(undefined)}
                                style={{ padding: 0, height: 'auto', fontSize: 11 }}
                              >
                                {t('debug.resetToDefault')}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Warning if NPC reply enabled but configs missing */}
                      {enableNpcReply && ((!npcClueTemplateId && !npcNoClueTemplateId) || !npcChatConfigId) && (
                        <Alert
                          type="warning"
                          message={t('debug.npcReplyConfigWarning')}
                          showIcon
                          style={{ fontSize: 12 }}
                        />
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* Middle: Match Results + Template Content + Locked Clues */}
        <Col xs={24} sm={24} md={16} lg={10} xl={10}>
          {/* Match Results */}
          {lastMatchResults && lastMatchResults.length > 0 && (
            <Card
              title={t('debug.matchResults')}
              size="small"
              style={{ marginBottom: 16 }}
            >
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
              <Table
                columns={matchResultColumns}
                dataSource={lastMatchResults}
                rowKey="clue_id"
                size="small"
                pagination={false}
                scroll={{ y: 200 }}
              />
            </Card>
          )}

          {/* Template Content Preview */}
          {selectedMatchingTemplate && (
            <Card
              title={t('debug.templateContent')}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <div
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  maxHeight: 200,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  border: '1px solid #d9d9d9',
                }}
              >
                {selectedMatchingTemplate.content}
              </div>
              {selectedMatchingTemplate.variables && selectedMatchingTemplate.variables.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('template.detectedVariables')}:</Text>
                  <div style={{ marginTop: 4 }}>
                    {selectedMatchingTemplate.variables.map((v, i) => (
                      <Tag key={i} color="blue" style={{ marginBottom: 4 }}>{v}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Locked Clues */}
          <Card
            title={
              <Space>
                <LockOutlined />
                {t('debug.lockedClues')}
                <Tag>{lockedClues.length}</Tag>
              </Space>
            }
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
                      {renderedPreviews[clue.id] && (
                        <Tag color="green" style={{ marginLeft: 8 }}>{t('debug.rendered')}</Tag>
                      )}
                    </Space>
                  ),
                  extra: matchingTemplateId && (
                    <Tooltip title={t('debug.renderPreview')}>
                      <Button
                        size="small"
                        type="text"
                        icon={renderingClueId === clue.id ? <Spin size="small" /> : <EyeOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenderClue(clue);
                        }}
                        disabled={renderingClueId !== null}
                      />
                    </Tooltip>
                  ),
                  children: (
                    <div>
                      {/* Clue Details */}
                      <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{t('clue.detail')}:</Text>
                        <Paragraph
                          style={{ margin: '4px 0', fontSize: 13 }}
                          ellipsis={{ rows: 2, expandable: true }}
                        >
                          {clue.detail}
                        </Paragraph>
                      </div>

                      {clue.trigger_keywords && clue.trigger_keywords.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>{t('clue.triggerKeywords')}:</Text>
                          <div style={{ marginTop: 4 }}>
                            {clue.trigger_keywords.map((kw, i) => (
                              <Tag key={i} style={{ marginBottom: 4 }}>{kw}</Tag>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rendered Preview */}
                      {renderedPreviews[clue.id] && (
                        <div style={{ marginTop: 12 }}>
                          <Divider style={{ margin: '8px 0' }} />
                          <Text strong style={{ color: '#1890ff', fontSize: 12 }}>
                            {t('debug.renderedResult')}:
                          </Text>
                          <div
                            style={{
                              background: '#e6f7ff',
                              padding: 12,
                              borderRadius: 6,
                              marginTop: 8,
                              border: '1px solid #91d5ff',
                              whiteSpace: 'pre-wrap',
                              fontSize: 13,
                              maxHeight: 150,
                              overflow: 'auto',
                            }}
                          >
                            {renderedPreviews[clue.id].rendered_content || t('template.emptyResult')}
                          </div>
                          {renderedPreviews[clue.id].warnings.length > 0 && (
                            <Alert
                              type="warning"
                              message={t('template.renderWarnings')}
                              description={renderedPreviews[clue.id].warnings.join(', ')}
                              style={{ marginTop: 8, fontSize: 12 }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            )}
          </Card>

          {/* NPC Clue Template Preview */}
          {selectedNpcClueTemplate && enableNpcReply && (
            <Card
              title={
                <Space>
                  <RobotOutlined />
                  {t('debug.npcClueTemplatePreview')}
                </Space>
              }
              size="small"
              style={{ marginTop: 16 }}
              extra={
                <Button
                  size="small"
                  icon={renderingNpcClueTemplate ? <Spin size="small" /> : <EyeOutlined />}
                  onClick={handleRenderNpcClueTemplate}
                  disabled={renderingNpcClueTemplate || !selectedNpc}
                >
                  {t('template.render')}
                </Button>
              }
            >
              <div
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  maxHeight: 150,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  border: '1px solid #d9d9d9',
                }}
              >
                {selectedNpcClueTemplate.content}
              </div>
              {selectedNpcClueTemplate.variables && selectedNpcClueTemplate.variables.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('template.detectedVariables')}:</Text>
                  <div style={{ marginTop: 4 }}>
                    {selectedNpcClueTemplate.variables.map((v, i) => (
                      <Tag key={i} color="purple" style={{ marginBottom: 4 }}>{v}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {/* Rendered Preview */}
              {npcClueTemplatePreview && (
                <div style={{ marginTop: 12 }}>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text strong style={{ color: '#722ed1', fontSize: 12 }}>
                    {t('debug.renderedResult')}:
                  </Text>
                  <div
                    style={{
                      background: '#f9f0ff',
                      padding: 12,
                      borderRadius: 6,
                      marginTop: 8,
                      border: '1px solid #d3adf7',
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {npcClueTemplatePreview.rendered_content || t('template.emptyResult')}
                  </div>
                  {npcClueTemplatePreview.warnings.length > 0 && (
                    <Alert
                      type="warning"
                      message={t('template.renderWarnings')}
                      description={npcClueTemplatePreview.warnings.join(', ')}
                      style={{ marginTop: 8, fontSize: 12 }}
                    />
                  )}
                </div>
              )}
            </Card>
          )}

          {/* NPC No-Clue Template Preview */}
          {selectedNpcNoClueTemplate && enableNpcReply && (
            <Card
              title={
                <Space>
                  <RobotOutlined />
                  {t('debug.npcNoClueTemplatePreview')}
                </Space>
              }
              size="small"
              style={{ marginTop: 16 }}
              extra={
                <Button
                  size="small"
                  icon={renderingNpcNoClueTemplate ? <Spin size="small" /> : <EyeOutlined />}
                  onClick={handleRenderNpcNoClueTemplate}
                  disabled={renderingNpcNoClueTemplate || !selectedNpc}
                >
                  {t('template.render')}
                </Button>
              }
            >
              <div
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  maxHeight: 150,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  border: '1px solid #d9d9d9',
                }}
              >
                {selectedNpcNoClueTemplate.content}
              </div>
              {selectedNpcNoClueTemplate.variables && selectedNpcNoClueTemplate.variables.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('template.detectedVariables')}:</Text>
                  <div style={{ marginTop: 4 }}>
                    {selectedNpcNoClueTemplate.variables.map((v, i) => (
                      <Tag key={i} color="orange" style={{ marginBottom: 4 }}>{v}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {/* Rendered Preview */}
              {npcNoClueTemplatePreview && (
                <div style={{ marginTop: 12 }}>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text strong style={{ color: '#fa8c16', fontSize: 12 }}>
                    {t('debug.renderedResult')}:
                  </Text>
                  <div
                    style={{
                      background: '#fff7e6',
                      padding: 12,
                      borderRadius: 6,
                      marginTop: 8,
                      border: '1px solid #ffd591',
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {npcNoClueTemplatePreview.rendered_content || t('template.emptyResult')}
                  </div>
                  {npcNoClueTemplatePreview.warnings.length > 0 && (
                    <Alert
                      type="warning"
                      message={t('template.renderWarnings')}
                      description={npcNoClueTemplatePreview.warnings.join(', ')}
                      style={{ marginTop: 8, fontSize: 12 }}
                    />
                  )}
                </div>
              )}
            </Card>
          )}
        </Col>

        {/* Right: Chat */}
        <Col xs={24} sm={24} md={24} lg={8} xl={8}>
          <Card
            title={t('debug.simulationChat')}
            size="small"
            extra={
              <Button icon={<ClearOutlined />} onClick={handleClear} size="small">
                {t('debug.clear')}
              </Button>
            }
            bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: 580 }}
          >
            {/* Chat messages area - scrollable */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                background: '#fafafa',
              }}
            >
              {chatHistory.length === 0 ? (
                <Empty description={t('debug.startMessage')} />
              ) : (
                chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: 16,
                      textAlign: msg.role === 'player' ? 'right' : 'left',
                    }}
                  >
                    <Space size={4}>
                      <Tag color={msg.role === 'player' ? 'blue' : msg.role === 'npc' ? 'purple' : 'green'}>
                        {msg.role === 'player' ? t('debug.player') : msg.role === 'npc' ? t('common.npc') : t('debug.system')}
                      </Tag>
                      {/* NPC clue trigger indicator */}
                      {msg.role === 'npc' && (
                        <Tag
                          icon={msg.hasTriggeredClues ? <BulbFilled /> : <BulbOutlined />}
                          color={msg.hasTriggeredClues ? 'success' : 'default'}
                        >
                          {msg.hasTriggeredClues
                            ? t('debug.clueTriggeredReply', { count: msg.triggeredClueCount })
                            : t('debug.noClueReply')
                          }
                        </Tag>
                      )}
                    </Space>
                    <div
                      style={{
                        display: 'inline-block',
                        maxWidth: '80%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: msg.role === 'player'
                          ? '#e6f7ff'
                          : msg.role === 'npc'
                            ? (msg.hasTriggeredClues ? '#f6ffed' : '#fff7e6')
                            : '#f6ffed',
                        marginTop: 4,
                        textAlign: 'left',
                        border: msg.role === 'npc'
                          ? (msg.hasTriggeredClues ? '1px solid #b7eb8f' : '1px solid #ffd591')
                          : 'none',
                      }}
                    >
                      {msg.content}
                      {msg.result && (
                        <Collapse
                          size="small"
                          style={{ marginTop: 8 }}
                          items={[
                            {
                              key: '1',
                              label: `${t('debug.matchDetails')} (${msg.result.matched_clues.length})`,
                              children: (
                                <div>
                                  {msg.result.matched_clues.map((mc: MatchedClue, j: number) => (
                                    <Descriptions key={j} size="small" column={1}>
                                      <Descriptions.Item label={t('debug.clue')}>
                                        {mc.name || mc.clue_id}
                                      </Descriptions.Item>
                                      <Descriptions.Item label={t('debug.score')}>
                                        {(mc.score * 100).toFixed(0)}%
                                      </Descriptions.Item>
                                      <Descriptions.Item label={t('debug.matchType')}>
                                        {mc.match_reasons.map((reason, k) => (
                                          <Tag key={k}>{reason}</Tag>
                                        ))}
                                      </Descriptions.Item>
                                    </Descriptions>
                                  ))}
                                </div>
                              ),
                            },
                          ]}
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Send area - fixed at bottom */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid #f0f0f0',
                background: '#fff',
              }}
            >
              <Space.Compact style={{ width: '100%' }}>
                <TextArea
                  placeholder={t('debug.enterPlayerMessage')}
                  value={playerMessage}
                  onChange={(e) => setPlayerMessage(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  style={{ resize: 'none' }}
                  rows={2}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={loading}
                  disabled={!selectedScriptId || !selectedNpcId}
                  style={{ height: 'auto' }}
                >
                  {t('debug.send')}
                </Button>
              </Space.Compact>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Favorite Modal */}
      <Modal
        title={
          <Space>
            <StarFilled style={{ color: '#faad14' }} />
            {editingFavoriteId ? t('debug.editFavorite') : t('debug.saveToFavorites')}
          </Space>
        }
        open={favoriteModalOpen}
        onOk={handleSaveToFavorites}
        onCancel={() => {
          setFavoriteModalOpen(false);
          setFavoriteName('');
          setFavoriteNote('');
          setEditingFavoriteId(null);
        }}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Text>{t('debug.presetName')}</Text>
          </div>
          <Input
            placeholder={t('debug.enterPresetName')}
            value={favoriteName}
            onChange={(e) => setFavoriteName(e.target.value)}
          />

          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <Text>{t('debug.presetNote')}</Text>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              ({t('debug.optional')})
            </Text>
          </div>
          <TextArea
            placeholder={t('debug.enterPresetNote')}
            value={favoriteNote}
            onChange={(e) => setFavoriteNote(e.target.value)}
            rows={3}
            maxLength={200}
            showCount
          />

          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('debug.presetSaveHint')}
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  );
}
