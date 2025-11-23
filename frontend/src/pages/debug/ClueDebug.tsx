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
  Result,
  Descriptions,
  Tag,
  Typography,
  Divider,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  BugOutlined,
} from '@ant-design/icons';
import { PageHeader, ClueTypeTag, ImportanceTag } from '@/components/common';
import { simulationApi, clueApi } from '@/api';
import { useScripts } from '@/hooks';
import type { Clue } from '@/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface DebugResult {
  keyword_match: boolean;
  keyword_details: Record<string, boolean>;
  semantic_match: boolean;
  semantic_score: number;
  state_match: boolean;
  state_details: Record<string, boolean>;
  final_result: boolean;
}

export default function ClueDebug() {
  const { t } = useTranslation();
  const { scripts, fetchScripts } = useScripts();

  const [clues, setClues] = useState<Clue[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null);
  const [playerMessage, setPlayerMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    if (selectedScriptId) {
      clueApi.list({ script_id: selectedScriptId, page_size: 100 }).then((data) => {
        setClues(data.items);
      });
    }
  }, [selectedScriptId]);

  useEffect(() => {
    if (selectedClueId) {
      const clue = clues.find((c) => c.id === selectedClueId);
      setSelectedClue(clue || null);
    } else {
      setSelectedClue(null);
    }
  }, [selectedClueId, clues]);

  const handleDebug = async () => {
    if (!selectedClueId || !playerMessage.trim()) {
      message.warning(t('debug.selectClueAndEnterMessage'));
      return;
    }

    setLoading(true);
    try {
      const debugResult = await simulationApi.debugClue(selectedClueId, playerMessage);
      setResult(debugResult);
    } catch {
      message.error(t('debug.debugFailed'));
    } finally {
      setLoading(false);
    }
  };

  const renderMatchStatus = (matched: boolean) => {
    return matched ? (
      <Tag icon={<CheckCircleOutlined />} color="success">
        {t('debug.matched')}
      </Tag>
    ) : (
      <Tag icon={<CloseCircleOutlined />} color="error">
        {t('debug.notMatched')}
      </Tag>
    );
  };

  return (
    <div>
      <PageHeader
        title={t('menu.singleClueDebug')}
        subtitle={t('debug.clueDebugSubtitle')}
      />

      <Row gutter={24}>
        <Col span={10}>
          <Card title={t('debug.debugConfiguration')} size="small">
            <Form layout="vertical">
              <Form.Item label={t('strategy.script')}>
                <Select
                  placeholder={t('debug.selectScript')}
                  value={selectedScriptId}
                  onChange={(v) => {
                    setSelectedScriptId(v);
                    setSelectedClueId(null);
                    setResult(null);
                  }}
                >
                  {scripts.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {s.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label={t('debug.clue')} required>
                <Select
                  placeholder={t('debug.selectClueToDebug')}
                  value={selectedClueId}
                  onChange={(v) => {
                    setSelectedClueId(v);
                    setResult(null);
                  }}
                  disabled={!selectedScriptId}
                  showSearch
                  optionFilterProp="children"
                >
                  {clues.map((c) => (
                    <Option key={c.id} value={c.id}>
                      {c.title_internal}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label={t('debug.playerMessage')} required>
                <TextArea
                  placeholder={t('debug.enterMessageToTest')}
                  value={playerMessage}
                  onChange={(e) => setPlayerMessage(e.target.value)}
                  rows={4}
                />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<BugOutlined />}
                  onClick={handleDebug}
                  loading={loading}
                  block
                >
                  {t('debug.debugClue')}
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {selectedClue && (
            <Card title={t('debug.selectedClueDetails')} size="small" style={{ marginTop: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={t('clue.internalTitle')}>
                  {selectedClue.title_internal}
                </Descriptions.Item>
                <Descriptions.Item label={t('clue.playerTitle')}>
                  {selectedClue.title_player}
                </Descriptions.Item>
                <Descriptions.Item label={t('clue.type')}>
                  <ClueTypeTag type={selectedClue.clue_type} />
                </Descriptions.Item>
                <Descriptions.Item label={t('clue.importance')}>
                  <ImportanceTag importance={selectedClue.importance} />
                </Descriptions.Item>
              </Descriptions>

              <Divider>{t('debug.unlockConditions')}</Divider>

              <div style={{ marginBottom: 8 }}>
                <Text strong>{t('debug.keywords')}:</Text>
                {selectedClue.unlock_conditions.text_conditions.keyword_lists.length === 0 ? (
                  <Text type="secondary"> {t('debug.noneConfigured')}</Text>
                ) : (
                  selectedClue.unlock_conditions.text_conditions.keyword_lists.map((kl, i) => (
                    <div key={i} style={{ marginTop: 4 }}>
                      <Tag color={kl.requirement === 'must' ? 'red' : 'blue'}>
                        {kl.requirement} ({kl.logic})
                      </Tag>
                      {kl.keywords.map((kw, j) => (
                        <Tag key={j}>{kw}</Tag>
                      ))}
                    </div>
                  ))
                )}
              </div>

              {selectedClue.unlock_conditions.text_conditions.blacklist.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <Text strong>{t('debug.blacklist')}:</Text>
                  {selectedClue.unlock_conditions.text_conditions.blacklist.map((bl, i) => (
                    <Tag key={i} color="error">
                      {bl}
                    </Tag>
                  ))}
                </div>
              )}

              {selectedClue.unlock_conditions.semantic_conditions && (
                <div style={{ marginBottom: 8 }}>
                  <Text strong>{t('debug.semanticConditions')}:</Text>
                  <div>
                    <Text type="secondary">
                      {t('debug.threshold')}: {selectedClue.unlock_conditions.semantic_conditions.similarity_threshold}
                    </Text>
                  </div>
                  <div>
                    {selectedClue.unlock_conditions.semantic_conditions.target_queries.map((q, i) => (
                      <Tag key={i} color="green">
                        {q}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              {selectedClue.unlock_conditions.state_conditions && (
                <div>
                  <Text strong>{t('debug.stateConditions')}:</Text>
                  <div>
                    <Text type="secondary">
                      {t('debug.prerequisites')}: {selectedClue.unlock_conditions.state_conditions.prerequisite_clue_ids.length} {t('logs.clues')}
                    </Text>
                    {selectedClue.unlock_conditions.state_conditions.stage_lock && (
                      <Text type="secondary">
                        {' '}| {t('debug.stageLock')}: {selectedClue.unlock_conditions.state_conditions.stage_lock}
                      </Text>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </Col>

        <Col span={14}>
          <Card title={t('debug.debugResults')} size="small">
            {!result ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <BugOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">{t('debug.selectClueAndMessage')}</Text>
                </div>
              </div>
            ) : (
              <div>
                <Result
                  status={result.final_result ? 'success' : 'error'}
                  title={result.final_result ? t('debug.clueWouldUnlock') : t('debug.clueWouldNotUnlock')}
                  subTitle={
                    result.final_result
                      ? t('debug.matchesConditions')
                      : t('debug.notMatchConditions')
                  }
                />

                <Divider>{t('debug.conditionBreakdown')}</Divider>

                <Card size="small" title={t('debug.keywordMatch')} style={{ marginBottom: 16 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>{t('debug.result')}: </Text>
                      {renderMatchStatus(result.keyword_match)}
                    </div>
                    {Object.keys(result.keyword_details).length > 0 && (
                      <div>
                        <Text strong>{t('debug.details')}:</Text>
                        <div style={{ marginTop: 8 }}>
                          {Object.entries(result.keyword_details).map(([keyword, matched]) => (
                            <Tag key={keyword} color={matched ? 'success' : 'default'}>
                              {keyword}: {matched ? t('abtest.yes') : t('abtest.no')}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </Space>
                </Card>

                <Card size="small" title={t('debug.semanticMatch')} style={{ marginBottom: 16 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>{t('debug.result')}: </Text>
                      {renderMatchStatus(result.semantic_match)}
                    </div>
                    <div>
                      <Text strong>{t('debug.similarityScore')}: </Text>
                      <Text>{(result.semantic_score * 100).toFixed(1)}%</Text>
                    </div>
                  </Space>
                </Card>

                <Card size="small" title={t('debug.stateMatch')}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>{t('debug.result')}: </Text>
                      {renderMatchStatus(result.state_match)}
                    </div>
                    {Object.keys(result.state_details).length > 0 && (
                      <div>
                        <Text strong>{t('debug.details')}:</Text>
                        <div style={{ marginTop: 8 }}>
                          {Object.entries(result.state_details).map(([condition, satisfied]) => (
                            <Tag key={condition} color={satisfied ? 'success' : 'default'}>
                              {condition}: {satisfied ? t('debug.satisfied') : t('debug.notSatisfied')}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </Space>
                </Card>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
