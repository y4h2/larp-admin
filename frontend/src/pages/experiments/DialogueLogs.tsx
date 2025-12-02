import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Input,
  Select,
  Space,
  Button,
  DatePicker,
  Tag,
  Modal,
  Descriptions,
  Typography,
  Collapse,
  Switch,
  Timeline,
  Tabs,
  Statistic,
  Row,
  Col,
  Table,
  Empty,
  Progress,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  MessageOutlined,
  UserOutlined,
  RobotOutlined,
  SettingOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';
import { logApi, templateApi, llmConfigApi, type PromptTemplate, type LLMConfig } from '@/api';
import { useScripts, useNpcs } from '@/hooks';
import { formatDate } from '@/utils';
import type { DialogueLog, MatchedClue } from '@/types';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text, Paragraph } = Typography;

// Grouped session type
interface SessionGroup {
  session_id: string;
  username: string | null;
  npc_id: string;
  npc_name: string;
  logs: DialogueLog[];
  total_clues: number;
  first_time: string;
  last_time: string;
}

// Helper component to show name with ID tooltip and more details
interface IdWithNameProps {
  id: string | null | undefined;
  type: 'template' | 'llmConfig';
  template?: PromptTemplate | null;
  llmConfig?: LLMConfig | null;
  t: ReturnType<typeof useTranslation>['t'];
}

const IdWithName: React.FC<IdWithNameProps> = ({ id, type, template, llmConfig, t }) => {
  if (!id) return <span>-</span>;

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
  };

  if (type === 'template') {
    const displayName = template?.name || id;
    return (
      <Tooltip
        title={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 400 }}>
            <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('common.name')}:</Text> <span style={{ color: '#fff' }}>{template?.name || '-'}</span></div>
            <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('template.type')}:</Text> <Tag color="blue" style={{ margin: 0 }}>{template?.type ? t(`template.types.${template.type}`) : '-'}</Tag></div>
            {template?.description && (
              <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('common.description')}:</Text> <span style={{ color: '#fff' }}>{template.description}</span></div>
            )}
            {template?.content && (
              <div>
                <Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('template.content')}:</Text>
                <pre style={{
                  color: '#fff',
                  fontSize: 11,
                  background: 'rgba(255,255,255,0.1)',
                  padding: 8,
                  borderRadius: 4,
                  marginTop: 4,
                  maxHeight: 150,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {template.content}
                </pre>
              </div>
            )}
            <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>ID:</Text> <Text code style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 11 }}>{id}</Text></div>
            <Button size="small" icon={<CopyOutlined />} onClick={handleCopy} style={{ marginTop: 4 }}>
              {t('common.copy')} ID
            </Button>
          </div>
        }
        overlayStyle={{ maxWidth: 450 }}
      >
        <Tag color="blue" style={{ cursor: 'pointer' }}>
          {displayName}
        </Tag>
      </Tooltip>
    );
  }

  // LLM Config
  const displayName = llmConfig?.name || id;
  return (
    <Tooltip
      title={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('common.name')}:</Text> <span style={{ color: '#fff' }}>{llmConfig?.name || '-'}</span></div>
          <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('llmConfig.type')}:</Text> <Tag color="green" style={{ margin: 0 }}>{llmConfig?.type ? t(`llmConfig.types.${llmConfig.type}`) : '-'}</Tag></div>
          <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('llmConfig.model')}:</Text> <span style={{ color: '#fff' }}>{llmConfig?.model || '-'}</span></div>
          <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>{t('llmConfig.baseUrl')}:</Text> <span style={{ color: '#fff', fontSize: 11 }}>{llmConfig?.base_url || '-'}</span></div>
          <div><Text style={{ color: 'rgba(255,255,255,0.65)' }}>ID:</Text> <Text code style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 11 }}>{id}</Text></div>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopy} style={{ marginTop: 4 }}>
            {t('common.copy')} ID
          </Button>
        </div>
      }
    >
      <Tag color="purple" style={{ cursor: 'pointer' }}>
        {displayName}
      </Tag>
    </Tooltip>
  );
};

export default function DialogueLogs() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<DialogueLog[]>([]);
  const [total, setTotal] = useState(0);
  const { scripts, fetchScripts } = useScripts();
  const { npcs, fetchNpcs } = useNpcs();
  const [selectedLog, setSelectedLog] = useState<DialogueLog | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupBySession, setGroupBySession] = useState(true);

  // Templates and LLM configs for name lookup
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([]);

  const [filters, setFilters] = useState<{
    script_id?: string;
    npc_id?: string;
    session_id?: string;
    start_date?: string;
    end_date?: string;
    page: number;
    page_size: number;
  }>({
    page: 1,
    page_size: 50,
  });

  useEffect(() => {
    fetchScripts();
    fetchNpcs();
    // Fetch templates and llm configs for name lookup
    templateApi.list({ page_size: 100 }).then((res) => {
      setTemplates(res?.items ?? []);
    }).catch(() => setTemplates([]));
    llmConfigApi.list({ page_size: 100 }).then((res) => {
      setLlmConfigs(res?.items ?? []);
    }).catch(() => setLlmConfigs([]));
  }, [fetchScripts, fetchNpcs]);

  const filteredNpcs = useMemo(() => {
    return filters.script_id
      ? npcs.filter((n) => n.script_id === filters.script_id)
      : npcs;
  }, [npcs, filters.script_id]);

  const getNpcName = (npcId: string) => {
    const npc = npcs.find((n) => n.id === npcId);
    return npc?.name || npcId;
  };

  const getTemplate = (templateId: string | undefined | null) => {
    if (!templateId) return null;
    return templates.find((t) => t.id === templateId) || null;
  };

  const getLlmConfig = (configId: string | undefined | null) => {
    if (!configId) return null;
    return llmConfigs.find((c) => c.id === configId) || null;
  };

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const data = await logApi.list(filters);
        setLogs(data.items);
        setTotal(data.total);
      } catch {
        // Error handled
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [filters]);

  const sessionGroups = useMemo((): SessionGroup[] => {
    const groups = new Map<string, SessionGroup>();
    logs.forEach((log) => {
      const key = log.session_id;
      if (!groups.has(key)) {
        groups.set(key, {
          session_id: log.session_id,
          username: log.username || null,
          npc_id: log.npc_id,
          npc_name: getNpcName(log.npc_id),
          logs: [],
          total_clues: 0,
          first_time: log.created_at,
          last_time: log.created_at,
        });
      }
      const group = groups.get(key)!;
      group.logs.push(log);
      group.total_clues += log.matched_clues?.length || 0;
      if (new Date(log.created_at) < new Date(group.first_time)) {
        group.first_time = log.created_at;
      }
      if (new Date(log.created_at) > new Date(group.last_time)) {
        group.last_time = log.created_at;
      }
    });
    groups.forEach((group) => {
      group.logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime()
    );
  }, [logs, npcs]);

  const flatColumns: ResizableColumn<DialogueLog>[] = [
    {
      title: t('logs.session'),
      dataIndex: 'session_id',
      key: 'session_id',
      width: 120,
      render: (id) => (
        <Text code copyable style={{ fontSize: 12 }}>
          {id?.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: t('logs.username'),
      dataIndex: 'username',
      key: 'username',
      width: 100,
      render: (username) => username || <Text type="secondary">{t('logs.noUsername')}</Text>,
    },
    {
      title: t('logs.playerMessage'),
      dataIndex: 'player_message',
      key: 'player_message',
      ellipsis: true,
      render: (msg) => <Text>{msg}</Text>,
    },
    {
      title: 'NPC',
      dataIndex: 'npc_id',
      key: 'npc_id',
      width: 100,
      render: (id) => getNpcName(id),
    },
    {
      title: t('logs.matchedClues'),
      dataIndex: 'matched_clues',
      key: 'matched_clues',
      width: 120,
      render: (clues: MatchedClue[]) => (
        <Tag color={clues?.length > 0 ? 'success' : 'default'}>{clues?.length || 0} {t('logs.clues')}</Tag>
      ),
    },
    {
      title: t('logs.time'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedLog(record);
            setModalVisible(true);
          }}
        />
      ),
    },
  ];

  const groupedColumns: ResizableColumn<SessionGroup>[] = [
    {
      title: t('logs.session'),
      dataIndex: 'session_id',
      key: 'session_id',
      width: 140,
      render: (id) => (
        <Text code copyable style={{ fontSize: 12 }}>
          {id?.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: t('logs.username'),
      dataIndex: 'username',
      key: 'username',
      width: 100,
      render: (username) => username || <Text type="secondary">{t('logs.noUsername')}</Text>,
    },
    {
      title: 'NPC',
      dataIndex: 'npc_name',
      key: 'npc_name',
      width: 120,
    },
    {
      title: t('logs.messageCount'),
      key: 'message_count',
      width: 100,
      render: (_, record) => (
        <Tag icon={<MessageOutlined />}>{record.logs.length}</Tag>
      ),
    },
    {
      title: t('logs.matchedClues'),
      dataIndex: 'total_clues',
      key: 'total_clues',
      width: 120,
      render: (count: number) => (
        <Tag color={count > 0 ? 'success' : 'default'}>{count} {t('logs.clues')}</Tag>
      ),
    },
    {
      title: t('logs.time'),
      key: 'time',
      width: 180,
      render: (_, record) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(record.first_time)}
        </Text>
      ),
    },
  ];

  const renderSessionDetail = (session: SessionGroup) => (
    <div style={{ padding: '8px 16px', background: '#fafafa' }}>
      <Timeline
        items={session.logs.map((log, index) => ({
          key: log.id,
          content: (
            <div style={{ marginBottom: index < session.logs.length - 1 ? 16 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <Tag icon={<UserOutlined />} color="blue">{t('logs.player')}</Tag>
                <div style={{ flex: 1 }}>
                  <Paragraph style={{ margin: 0 }}>{log.player_message}</Paragraph>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {formatDate(log.created_at)}
                  </Text>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    setSelectedLog(log);
                    setModalVisible(true);
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginLeft: 24 }}>
                <Tag icon={<RobotOutlined />} color="green">NPC</Tag>
                <div style={{ flex: 1 }}>
                  <Paragraph style={{ margin: 0 }}>{log.npc_response}</Paragraph>
                  {log.matched_clues?.length > 0 && (
                    <Space size={4} style={{ marginTop: 4 }} wrap>
                      <Text type="secondary" style={{ fontSize: 11 }}>{t('logs.matchedClues')}:</Text>
                      {log.matched_clues.map((mc, i) => (
                        <Tag key={i} color="orange" style={{ fontSize: 11 }}>
                          {mc.name || mc.clue_id?.slice(0, 12)}
                        </Tag>
                      ))}
                    </Space>
                  )}
                </div>
              </div>
            </div>
          ),
        }))}
      />
    </div>
  );

  // Render Tab 1: Dialogue Content
  const renderDialogueTab = (log: DialogueLog) => (
    <div>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label={t('logs.sessionId')} span={2}>
          <Text code copyable>{log.session_id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t('logs.time')}>{formatDate(log.created_at)}</Descriptions.Item>
        <Descriptions.Item label="NPC">{getNpcName(log.npc_id)}</Descriptions.Item>
      </Descriptions>

      <Card size="small" title={t('logs.playerMessage')} style={{ marginTop: 16 }}>
        <Paragraph>{log.player_message}</Paragraph>
      </Card>

      <Card size="small" title={t('logs.npcResponse')} style={{ marginTop: 16 }}>
        <Paragraph>{log.npc_response}</Paragraph>
      </Card>
    </div>
  );

  // Render Tab 2: Match Configuration
  const renderConfigTab = (log: DialogueLog) => {
    const context = log.context;
    if (!context) {
      return <Empty description={t('logs.noDebugInfo')} />;
    }

    return (
      <div>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label={t('logs.matchingStrategy')}>
            <Tag color="blue">{context.matching_strategy || '-'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('logs.threshold')}>
            {log.debug_info?.threshold != null ? (
              <Tag color="orange">{(log.debug_info.threshold * 100).toFixed(0)}%</Tag>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('logs.templateId')}>
            <IdWithName id={context.template_id} type="template" template={getTemplate(context.template_id)} t={t} />
          </Descriptions.Item>
          <Descriptions.Item label={t('logs.llmConfigId')}>
            <IdWithName id={context.llm_config_id} type="llmConfig" llmConfig={getLlmConfig(context.llm_config_id)} t={t} />
          </Descriptions.Item>
          <Descriptions.Item label={t('logs.npcClueTemplate')}>
            <IdWithName id={context.npc_clue_template_id} type="template" template={getTemplate(context.npc_clue_template_id)} t={t} />
          </Descriptions.Item>
          <Descriptions.Item label={t('logs.npcNoClueTemplate')}>
            <IdWithName id={context.npc_no_clue_template_id} type="template" template={getTemplate(context.npc_no_clue_template_id)} t={t} />
          </Descriptions.Item>
        </Descriptions>

        <Card size="small" title={t('logs.unlockedClues')} style={{ marginTop: 16 }}>
          {context.unlocked_clue_ids?.length > 0 ? (
            <Space wrap>
              {context.unlocked_clue_ids.map((id, i) => (
                <Tag key={i}>{id}</Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">{t('logs.noUnlockedClues')}</Text>
          )}
        </Card>
      </div>
    );
  };

  // Render Tab 3: Algorithm Flow
  const renderAlgorithmTab = (log: DialogueLog) => {
    const debugInfo = log.debug_info;
    const hasDebugInfo = debugInfo && Object.keys(debugInfo).length > 0;

    if (!hasDebugInfo) {
      return <Empty description={t('logs.noDebugInfo')} />;
    }

    const totalClues = debugInfo.total_clues || 0;
    const candidates = debugInfo.total_candidates || 0;
    const excluded = debugInfo.total_excluded || 0;
    const matched = debugInfo.total_matched || 0;
    const triggered = debugInfo.total_triggered || 0;

    return (
      <div>
        {/* Statistics */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title={t('logs.totalClues')}
                value={totalClues}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Card>
          </Col>
          <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text type="secondary">→</Text>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title={t('logs.candidates')}
                value={candidates}
                styles={{ content: { color: '#722ed1' } }}
              />
            </Card>
          </Col>
          <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text type="secondary">→</Text>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title={t('logs.matchedCount')}
                value={matched}
                styles={{ content: { color: '#fa8c16' } }}
              />
            </Card>
          </Col>
          <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text type="secondary">→</Text>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title={t('logs.triggeredCount')}
                value={triggered}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title={t('logs.excludedCount')}
                value={excluded}
                styles={{ content: { color: '#ff4d4f' } }}
              />
            </Card>
          </Col>
        </Row>

        {/* Matched Clues Table */}
        <Card size="small" title={t('logs.matchedCluesDetail')} style={{ marginBottom: 16 }}>
          {log.matched_clues?.length > 0 ? (
            <Table
              size="small"
              dataSource={log.matched_clues}
              rowKey="clue_id"
              pagination={false}
              columns={[
                {
                  title: t('logs.clueName'),
                  dataIndex: 'name',
                  key: 'name',
                  width: 150,
                  render: (name, record) => name || record.clue_id,
                },
                {
                  title: t('debug.score'),
                  dataIndex: 'score',
                  key: 'score',
                  width: 100,
                  render: (score: number) => (
                    <Progress
                      percent={Math.round(score * 100)}
                      size="small"
                      status={score >= 0.8 ? 'success' : score >= 0.5 ? 'normal' : 'exception'}
                    />
                  ),
                },
                {
                  title: t('logs.matchReasons'),
                  dataIndex: 'match_reasons',
                  key: 'match_reasons',
                  render: (reasons: string[]) => (
                    <Space wrap size={4}>
                      {reasons?.map((r, i) => (
                        <Tag
                          key={i}
                          color={r.includes('keyword') ? 'blue' : r.includes('LLM') ? 'purple' : 'green'}
                          style={{ maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-word', height: 'auto' }}
                        >
                          {r}
                        </Tag>
                      ))}
                    </Space>
                  ),
                },
                {
                  title: t('logs.triggered'),
                  dataIndex: 'is_triggered',
                  key: 'is_triggered',
                  width: 80,
                  render: (triggered: boolean) =>
                    triggered ? (
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                    ),
                },
              ]}
            />
          ) : (
            <Text type="secondary">{t('logs.noCluesMatched')}</Text>
          )}
        </Card>

        {/* Excluded Clues */}
        {debugInfo.excluded && debugInfo.excluded.length > 0 && (
          <Card size="small" title={t('logs.excludedClues')}>
            <Space wrap>
              {debugInfo.excluded.map((item, i) => {
                // Handle both old format (string) and new format (object)
                if (typeof item === 'string') {
                  return <Tag key={i} color="default">{item}</Tag>;
                }
                const excluded = item as { name?: string; reason?: string; clue_id?: string; missing_prereq_ids?: string[] };
                return (
                  <Tooltip
                    key={i}
                    title={
                      <div>
                        <div>{t('logs.excludeReason')}: {excluded.reason || '-'}</div>
                        {excluded.missing_prereq_ids && excluded.missing_prereq_ids.length > 0 && (
                          <div>{t('logs.missingPrereqs')}: {excluded.missing_prereq_ids.join(', ')}</div>
                        )}
                      </div>
                    }
                  >
                    <Tag color="default">{excluded.name || excluded.clue_id}</Tag>
                  </Tooltip>
                );
              })}
            </Space>
          </Card>
        )}
      </div>
    );
  };

  // Render Tab 4: Triggered Clues
  const renderTriggeredTab = (log: DialogueLog) => {
    const triggeredClues = log.matched_clues?.filter((mc) => mc.is_triggered) || [];

    if (triggeredClues.length === 0) {
      return <Empty description={t('logs.noCluesTriggered')} />;
    }

    return (
      <Collapse
        items={triggeredClues.map((mc, i) => ({
          key: i,
          label: (
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>{mc.name || mc.clue_id}</span>
              <Tag color="green">{(mc.score * 100).toFixed(0)}%</Tag>
            </Space>
          ),
          children: (
            <Descriptions size="small" column={1}>
              <Descriptions.Item label={t('logs.clueId')}>
                <Text code copyable>{mc.clue_id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('logs.clueType')}>
                <Tag>{mc.clue_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('logs.matchReasons')}>
                <Space wrap>
                  {mc.match_reasons?.map((r, j) => (
                    <Tag
                      key={j}
                      color={r.includes('keyword') ? 'blue' : r.includes('LLM') ? 'purple' : 'green'}
                      style={{ maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', height: 'auto' }}
                    >
                      {r}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              {mc.keyword_matches && mc.keyword_matches.length > 0 && (
                <Descriptions.Item label={t('debug.keywords')}>
                  <Space wrap>
                    {mc.keyword_matches.map((kw, j) => (
                      <Tag key={j} color="blue">{kw}</Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
              {mc.embedding_similarity != null && (
                <Descriptions.Item label={t('debug.similarity')}>
                  <Progress percent={Math.round(mc.embedding_similarity * 100)} size="small" />
                </Descriptions.Item>
              )}
            </Descriptions>
          ),
        }))}
      />
    );
  };

  // Render Tab 5: Prompt Info
  const renderPromptTab = (log: DialogueLog) => {
    const promptInfo = log.debug_info?.prompt_info;

    if (!promptInfo) {
      return <Empty description={t('logs.noPromptInfo')} />;
    }

    return (
      <div>
        {/* System Prompt */}
        {promptInfo.system_prompt && (
          <Card size="small" title={t('logs.systemPrompt')} style={{ marginBottom: 16 }}>
            <Paragraph
              copyable
              style={{
                whiteSpace: 'pre-wrap',
                backgroundColor: '#f5f5f5',
                padding: 12,
                borderRadius: 4,
                maxHeight: 300,
                overflow: 'auto',
              }}
            >
              {promptInfo.system_prompt}
            </Paragraph>
          </Card>
        )}

        {/* User Prompt */}
        {promptInfo.user_prompt && (
          <Card size="small" title={t('logs.userPrompt')} style={{ marginBottom: 16 }}>
            <Paragraph
              copyable
              style={{
                whiteSpace: 'pre-wrap',
                backgroundColor: '#e6f7ff',
                padding: 12,
                borderRadius: 4,
                maxHeight: 300,
                overflow: 'auto',
              }}
            >
              {promptInfo.user_prompt}
            </Paragraph>
          </Card>
        )}

        {/* Full Messages (if available) */}
        {promptInfo.messages && promptInfo.messages.length > 0 && (
          <Card size="small" title={t('logs.fullMessages')}>
            <Timeline
              items={promptInfo.messages.map((msg, i) => ({
                key: i,
                color: msg.role === 'system' ? 'gray' : msg.role === 'user' ? 'blue' : 'green',
                content: (
                  <div>
                    <Tag color={msg.role === 'system' ? 'default' : msg.role === 'user' ? 'blue' : 'green'}>
                      {msg.role === 'system' ? t('logs.messageRole') + ': System' :
                       msg.role === 'user' ? t('logs.messageRole') + ': User' :
                       t('logs.messageRole') + ': Assistant'}
                    </Tag>
                    <Paragraph
                      copyable
                      style={{
                        whiteSpace: 'pre-wrap',
                        backgroundColor: msg.role === 'system' ? '#f5f5f5' :
                                        msg.role === 'user' ? '#e6f7ff' : '#f6ffed',
                        padding: 8,
                        borderRadius: 4,
                        marginTop: 8,
                        maxHeight: 200,
                        overflow: 'auto',
                      }}
                    >
                      {msg.content}
                    </Paragraph>
                  </div>
                ),
              }))}
            />
          </Card>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title={t('logs.title')}
        subtitle={t('logs.subtitle')}
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Input
              placeholder={t('logs.sessionId')}
              prefix={<SearchOutlined />}
              value={filters.session_id}
              onChange={(e) => setFilters({ ...filters, session_id: e.target.value, page: 1 })}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder={t('script.title')}
              value={filters.script_id}
              onChange={(v) =>
                setFilters({ ...filters, script_id: v, npc_id: undefined, page: 1 })
              }
              style={{ width: 160 }}
              allowClear
            >
              {scripts.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.title}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="NPC"
              value={filters.npc_id}
              onChange={(v) => setFilters({ ...filters, npc_id: v, page: 1 })}
              style={{ width: 140 }}
              allowClear
              disabled={!filters.script_id}
            >
              {filteredNpcs.map((n) => (
                <Option key={n.id} value={n.id}>
                  {n.name}
                </Option>
              ))}
            </Select>
            <RangePicker
              onChange={(dates) => {
                setFilters({
                  ...filters,
                  start_date: dates?.[0]?.format('YYYY-MM-DD'),
                  end_date: dates?.[1]?.format('YYYY-MM-DD'),
                  page: 1,
                });
              }}
            />
          </Space>
          <Space>
            <Text type="secondary">{t('logs.groupBySession')}</Text>
            <Switch checked={groupBySession} onChange={setGroupBySession} />
          </Space>
        </Space>
      </Card>

      {groupBySession ? (
        <ResizableTable
          columns={groupedColumns}
          dataSource={sessionGroups}
          rowKey="session_id"
          loading={loading}
          expandable={{
            expandedRowRender: renderSessionDetail,
            rowExpandable: () => true,
          }}
          pagination={{
            current: filters.page,
            pageSize: filters.page_size,
            total,
            showSizeChanger: true,
            showTotal: (total: number) => t('logs.totalLogs', { total }),
            onChange: (page: number, pageSize: number) => setFilters({ ...filters, page, page_size: pageSize }),
          }}
        />
      ) : (
        <ResizableTable
          columns={flatColumns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: filters.page,
            pageSize: filters.page_size,
            total,
            showSizeChanger: true,
            showTotal: (total: number) => t('logs.totalLogs', { total }),
            onChange: (page: number, pageSize: number) => setFilters({ ...filters, page, page_size: pageSize }),
          }}
        />
      )}

      <Modal
        title={t('logs.logDetails')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedLog && (
          <Tabs
            defaultActiveKey="dialogue"
            items={[
              {
                key: 'dialogue',
                label: (
                  <span>
                    <MessageOutlined />
                    {t('logs.dialogueContent')}
                  </span>
                ),
                children: renderDialogueTab(selectedLog),
              },
              {
                key: 'config',
                label: (
                  <span>
                    <SettingOutlined />
                    {t('logs.matchConfig')}
                  </span>
                ),
                children: renderConfigTab(selectedLog),
              },
              {
                key: 'algorithm',
                label: (
                  <span>
                    <ExperimentOutlined />
                    {t('logs.algorithmFlow')}
                  </span>
                ),
                children: renderAlgorithmTab(selectedLog),
              },
              {
                key: 'triggered',
                label: (
                  <span>
                    <CheckCircleOutlined />
                    {t('logs.triggeredClues')} ({selectedLog.matched_clues?.filter((mc) => mc.is_triggered).length || 0})
                  </span>
                ),
                children: renderTriggeredTab(selectedLog),
              },
              {
                key: 'prompts',
                label: (
                  <span>
                    <CodeOutlined />
                    {t('logs.promptInfo')}
                  </span>
                ),
                children: renderPromptTab(selectedLog),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
