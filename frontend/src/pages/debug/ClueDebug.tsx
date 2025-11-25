import { useEffect, useState } from 'react';
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
  Descriptions,
  Tag,
  Typography,
  message,
  Empty,
  Progress,
  Alert,
  Divider,
  Table,
} from 'antd';
import { BugOutlined, ThunderboltOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons';
import { PageHeader, ClueTypeTag } from '@/components/common';
import { clueApi, npcApi } from '@/api';
import { simulationApi } from '@/api/simulation';
import { templateApi, type PromptTemplate } from '@/api/templates';
import { llmConfigApi, type LLMConfig } from '@/api/llmConfigs';
import { useScripts } from '@/hooks';
import type { Clue, MatchingStrategy, MatchedClue, NPC } from '@/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

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
  const [selectedClue, _setSelectedClue] = useState<Clue | null>(null);
  void _setSelectedClue; // Reserved for future clue selection feature
  const [loading, setLoading] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchedClue[] | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);

  const selectedScriptId = Form.useWatch('script_id', form);
  const selectedNpcId = Form.useWatch('npc_id', form);
  const selectedStrategy = Form.useWatch('matching_strategy', form) as MatchingStrategy | undefined;

  useEffect(() => {
    fetchScripts();
    // Fetch templates for LLM matching
    templateApi.list({ type: 'clue_reveal', page_size: 100 }).then((res) => {
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
        <Col span={12}>
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
                <>
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
                  <Form.Item
                    name="template_id"
                    label={t('debug.selectTemplate')}
                    extra={t('debug.templateHint')}
                  >
                    <Select placeholder={t('debug.selectTemplate')} allowClear>
                      {templates.map((tpl) => (
                        <Option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                          {tpl.is_default && <Tag color="gold" style={{ marginLeft: 8 }}>{t('template.default')}</Tag>}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </>
              )}

              <Form.Item
                name="unlocked_clue_ids"
                label={t('debug.unlockedClues')}
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
                  rows={4}
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
        </Col>

        <Col span={12}>
          <Card title={t('debug.selectedClueDetails')} size="small" style={{ marginBottom: 16 }}>
            {selectedClue ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label={t('common.name')}>
                  {selectedClue.name}
                </Descriptions.Item>
                <Descriptions.Item label={t('clue.type')}>
                  <ClueTypeTag type={selectedClue.type} />
                </Descriptions.Item>
                <Descriptions.Item label={t('clue.detail')}>
                  <Text ellipsis>{selectedClue.detail}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('clue.triggerKeywords')}>
                  <Space size={[0, 4]} wrap>
                    {selectedClue.trigger_keywords?.map((kw, i) => (
                      <Tag key={i}>{kw}</Tag>
                    ))}
                    {(!selectedClue.trigger_keywords || selectedClue.trigger_keywords.length === 0) && (
                      <Text type="secondary">{t('debug.noneConfigured')}</Text>
                    )}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label={t('clue.triggerSemanticSummary')}>
                  <Text type="secondary">
                    {selectedClue.trigger_semantic_summary || t('debug.noneConfigured')}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description={t('debug.selectClueAndMessage')} />
            )}
          </Card>

          {matchResults && (
            <Card title={t('debug.matchResults')} size="small">
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
      </Row>
    </div>
  );
}
