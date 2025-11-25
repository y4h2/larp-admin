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
  MessageOutlined,
} from '@ant-design/icons';
import { PageHeader, ClueTypeTag } from '@/components/common';
import { simulationApi, clueApi } from '@/api';
import { templateApi, type PromptTemplate, type TemplateRenderResponse } from '@/api/templates';
import { llmConfigApi, type LLMConfig } from '@/api/llmConfigs';
import { useScripts, useNpcs } from '@/hooks';
import type { Clue, SimulationResult, MatchedClue, MatchingStrategy } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Paragraph } = Typography;

const MATCHING_STRATEGIES: { value: MatchingStrategy; label: string; icon: React.ReactNode }[] = [
  { value: 'keyword', label: 'debug.keywordMatching', icon: <SearchOutlined /> },
  { value: 'embedding', label: 'debug.embeddingMatching', icon: <ThunderboltOutlined /> },
  { value: 'llm', label: 'debug.llmMatching', icon: <RobotOutlined /> },
];

interface ChatMessage {
  role: 'player' | 'system' | 'npc';
  content: string;
  result?: SimulationResult;
}

export default function DialogueSimulation() {
  const { t } = useTranslation();
  const { scripts, fetchScripts } = useScripts();
  const { npcs, fetchNpcs } = useNpcs();
  const [clues, setClues] = useState<Clue[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [embeddingConfigs, setEmbeddingConfigs] = useState<LLMConfig[]>([]);
  const [chatConfigs, setChatConfigs] = useState<LLMConfig[]>([]);

  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [unlockedClueIds, setUnlockedClueIds] = useState<string[]>([]);

  // Session tracking - generate new session ID on mount and when cleared
  const sessionIdRef = useRef<string>(uuidv4());

  // Matching configuration
  const [matchingStrategy, setMatchingStrategy] = useState<MatchingStrategy>('keyword');
  const [matchingTemplateId, setMatchingTemplateId] = useState<string | undefined>();
  const [matchingLlmConfigId, setMatchingLlmConfigId] = useState<string | undefined>();

  // NPC reply configuration
  const [enableNpcReply, setEnableNpcReply] = useState(false);
  const [npcSystemTemplateId, setNpcSystemTemplateId] = useState<string | undefined>();
  const [npcChatConfigId, setNpcChatConfigId] = useState<string | undefined>();

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [playerMessage, setPlayerMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Match results for table display
  const [lastMatchResults, setLastMatchResults] = useState<MatchedClue[] | null>(null);
  const [lastDebugInfo, setLastDebugInfo] = useState<Record<string, unknown> | null>(null);

  // Template rendering
  const [renderedPreviews, setRenderedPreviews] = useState<Record<string, TemplateRenderResponse>>({});
  const [renderingClueId, setRenderingClueId] = useState<string | null>(null);

  // Filter templates by type
  const matchingTemplates = templates.filter((t) =>
    ['clue_embedding', 'clue_reveal', 'custom'].includes(t.type)
  );
  const npcSystemTemplates = templates.filter((t) =>
    ['npc_system_prompt', 'custom'].includes(t.type)
  );

  // Get selected template object
  const selectedMatchingTemplate = useMemo(() => {
    return templates.find((t) => t.id === matchingTemplateId) || null;
  }, [templates, matchingTemplateId]);

  // Get selected NPC object
  const selectedNpc = useMemo(() => {
    return npcs.find((n) => n.id === selectedNpcId) || null;
  }, [npcs, selectedNpcId]);

  // Compute locked clues (clues not in unlocked list)
  const lockedClues = useMemo(() => {
    const unlockedSet = new Set(unlockedClueIds || []);
    return clues.filter((c) => !unlockedSet.has(c.id));
  }, [clues, unlockedClueIds]);

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
        npc_system_template_id: enableNpcReply ? npcSystemTemplateId : undefined,
        npc_chat_config_id: enableNpcReply ? npcChatConfigId : undefined,
        session_id: sessionIdRef.current,
        save_log: true,
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
        const npcMessage: ChatMessage = {
          role: 'npc',
          content: result.npc_response,
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

  return (
    <div>
      <PageHeader
        title={t('debug.simulation')}
        subtitle={t('debug.simulationSubtitle')}
      />

      <Row gutter={16}>
        {/* Left: Configuration */}
        <Col span={6}>
          <Card title={t('debug.configuration')} size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <div style={{ marginBottom: 4 }}>{t('debug.selectScript')}</div>
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
                <div style={{ marginBottom: 4 }}>{t('debug.selectNpc')}</div>
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
                <div style={{ marginBottom: 4 }}>{t('debug.unlockedClues')}</div>
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

              <Divider orientation="left" plain style={{ margin: '12px 0' }}>
                {t('debug.matchingConfig')}
              </Divider>

              <div>
                <div style={{ marginBottom: 4 }}>{t('debug.matchingStrategy')}</div>
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
                <div style={{ marginBottom: 4 }}>{t('debug.matchingTemplate')}</div>
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
                <div>
                  <div style={{ marginBottom: 4 }}>{t('debug.selectEmbeddingConfig')}</div>
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
              )}

              {matchingStrategy === 'llm' && (
                <div>
                  <div style={{ marginBottom: 4 }}>{t('debug.selectChatConfig')}</div>
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

              <Divider orientation="left" plain style={{ margin: '12px 0' }}>
                <Space>
                  <MessageOutlined />
                  {t('debug.npcReplyConfig')}
                </Space>
              </Divider>

              <div style={{ marginBottom: 12 }}>
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
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('debug.enableNpcReplyHint')}
                  </Text>
                </div>
              </div>

              <div>
                <div style={{ marginBottom: 4 }}>{t('debug.npcSystemTemplate')}</div>
                <Select
                  placeholder={t('debug.selectNpcSystemTemplate')}
                  value={npcSystemTemplateId}
                  onChange={setNpcSystemTemplateId}
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
              </div>

              <div>
                <div style={{ marginBottom: 4 }}>{t('debug.npcChatModel')}</div>
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
            </Space>
          </Card>
        </Col>

        {/* Middle: Match Results + Template Content + Locked Clues */}
        <Col span={10}>
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
        </Col>

        {/* Right: Chat */}
        <Col span={8}>
          <Card
            title={t('debug.simulationChat')}
            size="small"
            extra={
              <Button icon={<ClearOutlined />} onClick={handleClear} size="small">
                {t('debug.clear')}
              </Button>
            }
          >
            <div
              style={{
                height: 500,
                overflowY: 'auto',
                marginBottom: 16,
                padding: 16,
                background: '#fafafa',
                borderRadius: 8,
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
                    <Tag color={msg.role === 'player' ? 'blue' : msg.role === 'npc' ? 'purple' : 'green'}>
                      {msg.role === 'player' ? t('debug.player') : msg.role === 'npc' ? t('common.npc') : t('debug.system')}
                    </Tag>
                    <div
                      style={{
                        display: 'inline-block',
                        maxWidth: '80%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: msg.role === 'player' ? '#e6f7ff' : msg.role === 'npc' ? '#f9f0ff' : '#f6ffed',
                        marginTop: 4,
                        textAlign: 'left',
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
              >
                {t('debug.send')}
              </Button>
            </Space.Compact>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
