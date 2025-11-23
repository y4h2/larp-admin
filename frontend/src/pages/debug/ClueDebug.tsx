import { useEffect, useState } from 'react';
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
      clueApi.list({ script_id: selectedScriptId, page_size: 500 }).then((data) => {
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
      message.warning('Please select a clue and enter a message');
      return;
    }

    setLoading(true);
    try {
      const debugResult = await simulationApi.debugClue(selectedClueId, playerMessage);
      setResult(debugResult);
    } catch {
      message.error('Debug failed');
    } finally {
      setLoading(false);
    }
  };

  const renderMatchStatus = (matched: boolean) => {
    return matched ? (
      <Tag icon={<CheckCircleOutlined />} color="success">
        Matched
      </Tag>
    ) : (
      <Tag icon={<CloseCircleOutlined />} color="error">
        Not Matched
      </Tag>
    );
  };

  return (
    <div>
      <PageHeader
        title="Single Clue Debug"
        subtitle="Debug individual clue matching conditions"
      />

      <Row gutter={24}>
        <Col span={10}>
          <Card title="Debug Configuration" size="small">
            <Form layout="vertical">
              <Form.Item label="Script">
                <Select
                  placeholder="Select script"
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
              <Form.Item label="Clue" required>
                <Select
                  placeholder="Select clue to debug"
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
              <Form.Item label="Player Message" required>
                <TextArea
                  placeholder="Enter the player message to test against this clue"
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
                  Debug Clue
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {selectedClue && (
            <Card title="Selected Clue Details" size="small" style={{ marginTop: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Internal Title">
                  {selectedClue.title_internal}
                </Descriptions.Item>
                <Descriptions.Item label="Player Title">
                  {selectedClue.title_player}
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  <ClueTypeTag type={selectedClue.clue_type} />
                </Descriptions.Item>
                <Descriptions.Item label="Importance">
                  <ImportanceTag importance={selectedClue.importance} />
                </Descriptions.Item>
              </Descriptions>

              <Divider>Unlock Conditions</Divider>

              <div style={{ marginBottom: 8 }}>
                <Text strong>Keywords:</Text>
                {selectedClue.unlock_conditions.text_conditions.keyword_lists.length === 0 ? (
                  <Text type="secondary"> None configured</Text>
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
                  <Text strong>Blacklist:</Text>
                  {selectedClue.unlock_conditions.text_conditions.blacklist.map((bl, i) => (
                    <Tag key={i} color="error">
                      {bl}
                    </Tag>
                  ))}
                </div>
              )}

              {selectedClue.unlock_conditions.semantic_conditions && (
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Semantic Conditions:</Text>
                  <div>
                    <Text type="secondary">
                      Threshold: {selectedClue.unlock_conditions.semantic_conditions.similarity_threshold}
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
                  <Text strong>State Conditions:</Text>
                  <div>
                    <Text type="secondary">
                      Prerequisites: {selectedClue.unlock_conditions.state_conditions.prerequisite_clue_ids.length} clues
                    </Text>
                    {selectedClue.unlock_conditions.state_conditions.stage_lock && (
                      <Text type="secondary">
                        {' '}| Stage Lock: {selectedClue.unlock_conditions.state_conditions.stage_lock}
                      </Text>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </Col>

        <Col span={14}>
          <Card title="Debug Results" size="small">
            {!result ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <BugOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">Select a clue and enter a message to debug</Text>
                </div>
              </div>
            ) : (
              <div>
                <Result
                  status={result.final_result ? 'success' : 'error'}
                  title={result.final_result ? 'Clue Would Be Unlocked' : 'Clue Would NOT Be Unlocked'}
                  subTitle={
                    result.final_result
                      ? 'The player message matches this clue\'s unlock conditions'
                      : 'The player message does not satisfy the unlock conditions'
                  }
                />

                <Divider>Condition Breakdown</Divider>

                <Card size="small" title="Keyword Match" style={{ marginBottom: 16 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>Result: </Text>
                      {renderMatchStatus(result.keyword_match)}
                    </div>
                    {Object.keys(result.keyword_details).length > 0 && (
                      <div>
                        <Text strong>Details:</Text>
                        <div style={{ marginTop: 8 }}>
                          {Object.entries(result.keyword_details).map(([keyword, matched]) => (
                            <Tag key={keyword} color={matched ? 'success' : 'default'}>
                              {keyword}: {matched ? 'Yes' : 'No'}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </Space>
                </Card>

                <Card size="small" title="Semantic Match" style={{ marginBottom: 16 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>Result: </Text>
                      {renderMatchStatus(result.semantic_match)}
                    </div>
                    <div>
                      <Text strong>Similarity Score: </Text>
                      <Text>{(result.semantic_score * 100).toFixed(1)}%</Text>
                    </div>
                  </Space>
                </Card>

                <Card size="small" title="State Match">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>Result: </Text>
                      {renderMatchStatus(result.state_match)}
                    </div>
                    {Object.keys(result.state_details).length > 0 && (
                      <div>
                        <Text strong>Details:</Text>
                        <div style={{ marginTop: 8 }}>
                          {Object.entries(result.state_details).map(([condition, satisfied]) => (
                            <Tag key={condition} color={satisfied ? 'success' : 'default'}>
                              {condition}: {satisfied ? 'Satisfied' : 'Not Satisfied'}
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
