import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Form,
  Select,
  Input,
  Button,
  Space,
  Row,
  Col,
  Tag,
  Typography,
  message,
  Empty,
  Progress,
  Alert,
  Divider,
  Table,
  Collapse,
  Spin,
  Tooltip,
} from 'antd';
import {
  BugOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  SearchOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { PageHeader, ClueTypeTag } from '@/components/common';
import { clueApi, npcApi } from '@/api';
import { simulationApi } from '@/api/simulation';
import { templateApi, type PromptTemplate, type TemplateRenderResponse } from '@/api/templates';
import { llmConfigApi, type LLMConfig } from '@/api/llmConfigs';
import { useScripts } from '@/hooks';
import type { Clue, MatchingStrategy, MatchedClue, NPC } from '@/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Paragraph } = Typography;

const MATCHING_STRATEGIES: { value: MatchingStrategy; label: string; icon: React.ReactNode }[] = [
  { value: 'keyword', label: 'debug.keywordMatching', icon: <SearchOutlined /> },
  { value: 'embedding', label: 'debug.embeddingMatching', icon: <ThunderboltOutlined /> },
  { value: 'llm', label: 'debug.llmMatching', icon: <RobotOutlined /> },
];

export default function ClueDebug() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { scripts, fetchScripts } = useScripts();

  const [clues, setClues] = useState<Clue[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [embeddingConfigs, setEmbeddingConfigs] = useState<LLMConfig[]>([]);
  const [chatConfigs, setChatConfigs] = useState<LLMConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchedClue[] | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [renderedPreviews, setRenderedPreviews] = useState<Record<string, TemplateRenderResponse>>({});
  const [renderingClueId, setRenderingClueId] = useState<string | null>(null);

  const selectedScriptId = Form.useWatch('script_id', form);
  const selectedNpcId = Form.useWatch('npc_id', form);
  const selectedStrategy = Form.useWatch('matching_strategy', form) as MatchingStrategy | undefined;
  const selectedTemplateId = Form.useWatch('template_id', form) as string | undefined;
  const unlockedClueIds = Form.useWatch('unlocked_clue_ids', form) as string[] | undefined;

  // Get selected template object
  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

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
      // Fetch NPCs for the script
      npcApi.list({ script_id: selectedScriptId, page_size: 100 }).then((res) => {
        setNpcs(res.items);
      });
    } else {
      setNpcs([]);
      setClues([]);
    }
  }, [selectedScriptId]);

  useEffect(() => {
    if (selectedScriptId && selectedNpcId) {
      clueApi.list({ script_id: selectedScriptId, npc_id: selectedNpcId, page_size: 100 }).then((res) => {
        setClues(res.items);
      });
    } else if (selectedScriptId) {
      clueApi.list({ script_id: selectedScriptId, page_size: 100 }).then((res) => {
        setClues(res.items);
      });
    } else {
      setClues([]);
    }
  }, [selectedScriptId, selectedNpcId]);

  // Auto-render all locked clues when template or locked clues change
  useEffect(() => {
    setRenderedPreviews({});

    // Auto-render if template is selected and there are locked clues
    if (selectedTemplateId && lockedClues.length > 0 && selectedNpc) {
      const renderAllLocked = async () => {
        const previews: Record<string, TemplateRenderResponse> = {};
        for (const clue of lockedClues) {
          try {
            const result = await templateApi.render({
              template_id: selectedTemplateId,
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
  }, [selectedTemplateId, lockedClues, selectedNpc]);

  const handleDebug = async () => {
    const values = form.getFieldsValue();
    if (!selectedScriptId || !selectedNpcId || !values.player_message) {
      message.warning(t('debug.fillAllFields'));
      return;
    }

    setLoading(true);
    setMatchResults(null);
    setDebugInfo(null);

    try {
      const result = await simulationApi.run({
        script_id: selectedScriptId,
        npc_id: selectedNpcId,
        player_message: values.player_message,
        unlocked_clue_ids: values.unlocked_clue_ids || [],
        matching_strategy: values.matching_strategy || 'keyword',
        template_id: values.template_id,
        llm_config_id: values.llm_config_id,
      });

      setMatchResults(result.matched_clues);
      setDebugInfo(result.debug_info);

      if (result.triggered_clues.length > 0) {
        message.success(t('debug.cluesTriggered', { count: result.triggered_clues.length }));
      } else {
        message.info(t('debug.noCluesTriggered'));
      }
    } catch {
      message.error(t('debug.debugFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Render template for a specific clue
  const handleRenderClue = async (clue: Clue) => {
    if (!selectedTemplateId) {
      message.warning(t('debug.selectTemplateFirst'));
      return;
    }

    setRenderingClueId(clue.id);
    try {
      const result = await templateApi.render({
        template_id: selectedTemplateId,
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

  // Render all locked clues
  const handleRenderAllClues = async () => {
    if (!selectedTemplateId) {
      message.warning(t('debug.selectTemplateFirst'));
      return;
    }

    for (const clue of lockedClues) {
      await handleRenderClue(clue);
    }
  };

  const resultColumns = [
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
      width: 150,
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

  return (
    <div>
      <PageHeader
        title={t('debug.clueDebug')}
        subtitle={t('debug.clueDebugSubtitle')}
      />

      <Row gutter={16}>
        <Col span={10}>
          <Card title={t('debug.debugConfiguration')} size="small">
            <Form form={form} layout="vertical" initialValues={{ matching_strategy: 'keyword' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="script_id" label={t('debug.selectScript')}>
                    <Select placeholder={t('debug.selectScript')} allowClear>
                      {scripts.map((s) => (
                        <Option key={s.id} value={s.id}>
                          {s.title}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="npc_id" label={t('debug.selectNpc')}>
                    <Select
                      placeholder={t('debug.selectNpc')}
                      disabled={!selectedScriptId}
                      allowClear
                    >
                      {npcs.map((n) => (
                        <Option key={n.id} value={n.id}>
                          {n.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" plain>
                {t('debug.matchingConfig')}
              </Divider>

              <Form.Item
                name="matching_strategy"
                label={t('debug.matchingStrategy')}
              >
                <Select>
                  {MATCHING_STRATEGIES.map((s) => (
                    <Option key={s.value} value={s.value}>
                      <Space>
                        {s.icon}
                        {t(s.label)}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {selectedStrategy === 'embedding' && (
                <Form.Item
                  name="llm_config_id"
                  label={t('debug.selectEmbeddingConfig')}
                  extra={t('debug.embeddingConfigHint')}
                >
                  <Select placeholder={t('debug.selectEmbeddingConfig')} allowClear>
                    {embeddingConfigs.map((config) => (
                      <Option key={config.id} value={config.id}>
                        <Space>
                          <span>{config.name}</span>
                          <Text type="secondary" style={{ fontSize: 12 }}>({config.model})</Text>
                        </Space>
                        {config.is_default && <Tag color="gold" style={{ marginLeft: 8 }}>{t('llmConfig.default')}</Tag>}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}

              {selectedStrategy === 'llm' && (
                <Form.Item
                  name="llm_config_id"
                  label={t('debug.selectChatConfig')}
                  extra={t('debug.chatConfigHint')}
                >
                  <Select placeholder={t('debug.selectChatConfig')} allowClear>
                    {chatConfigs.map((config) => (
                      <Option key={config.id} value={config.id}>
                        <Space>
                          <span>{config.name}</span>
                          <Text type="secondary" style={{ fontSize: 12 }}>({config.model})</Text>
                        </Space>
                        {config.is_default && <Tag color="gold" style={{ marginLeft: 8 }}>{t('llmConfig.default')}</Tag>}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}

              <Form.Item
                name="template_id"
                label={t('debug.selectTemplate')}
                extra={t('debug.templateHint')}
              >
                <Select placeholder={t('debug.selectTemplate')} allowClear>
                  {templates.map((tpl) => (
                    <Option key={tpl.id} value={tpl.id}>
                      <Space>
                        <span>{tpl.name}</span>
                        <Tag color={tpl.type === 'clue_reveal' ? 'orange' : tpl.type === 'clue_embedding' ? 'blue' : 'default'}>
                          {t(`template.types.${tpl.type}`)}
                        </Tag>
                      </Space>
                      {tpl.is_default && <Tag color="gold" style={{ marginLeft: 8 }}>{t('template.default')}</Tag>}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="unlocked_clue_ids"
                label={
                  <Space>
                    <UnlockOutlined />
                    {t('debug.unlockedClues')}
                  </Space>
                }
                extra={t('debug.unlockedCluesExtra')}
              >
                <Select
                  mode="multiple"
                  placeholder={t('debug.selectUnlockedClues')}
                  disabled={!selectedScriptId}
                  allowClear
                >
                  {clues.map((c) => (
                    <Option key={c.id} value={c.id}>
                      {c.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="player_message" label={t('debug.playerMessage')}>
                <TextArea
                  rows={3}
                  placeholder={t('debug.enterMessageToTest')}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  icon={<BugOutlined />}
                  onClick={handleDebug}
                  loading={loading}
                  disabled={!selectedScriptId || !selectedNpcId}
                >
                  {t('debug.debugClue')}
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {/* Match Results */}
          {matchResults && (
            <Card title={t('debug.matchResults')} size="small" style={{ marginTop: 16 }}>
              {debugInfo && (
                <Alert
                  message={t('debug.debugSummary')}
                  description={
                    <Space direction="vertical" size={0}>
                      <Text>{t('debug.totalCandidates')}: {String(debugInfo.total_candidates ?? 0)}</Text>
                      <Text>{t('debug.totalMatched')}: {String(debugInfo.total_matched ?? 0)}</Text>
                      <Text>{t('debug.totalTriggered')}: {String(debugInfo.total_triggered ?? 0)}</Text>
                      <Text>{t('debug.strategy')}: {t(`debug.${String(debugInfo.strategy ?? 'keyword')}Matching`)}</Text>
                    </Space>
                  }
                  type="info"
                  style={{ marginBottom: 16 }}
                />
              )}
              <Table
                columns={resultColumns}
                dataSource={matchResults}
                rowKey="clue_id"
                size="small"
                pagination={false}
              />
            </Card>
          )}
        </Col>

        <Col span={14}>
          {/* Template Content Preview */}
          {selectedTemplate && (
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
                  maxHeight: 300,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  border: '1px solid #d9d9d9',
                }}
              >
                {selectedTemplate.content}
              </div>
              {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('template.detectedVariables')}:</Text>
                  <div style={{ marginTop: 4 }}>
                    {selectedTemplate.variables.map((v, i) => (
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
            extra={
              selectedTemplateId && lockedClues.length > 0 && (
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={handleRenderAllClues}
                  disabled={renderingClueId !== null}
                >
                  {t('debug.renderAll')}
                </Button>
              )
            }
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
                  extra: selectedTemplateId && (
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

                      {clue.detail_for_npc && (
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>{t('clue.detailForNpc')}:</Text>
                          <Paragraph
                            style={{ margin: '4px 0', fontSize: 13 }}
                            ellipsis={{ rows: 2, expandable: true }}
                          >
                            {clue.detail_for_npc}
                          </Paragraph>
                        </div>
                      )}

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
                              maxHeight: 200,
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
      </Row>
    </div>
  );
}
