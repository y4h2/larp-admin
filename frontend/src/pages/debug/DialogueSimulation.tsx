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
  Table,
  Tag,
  Descriptions,
  Divider,
  Progress,
  Collapse,
  Empty,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import {
  SendOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/common';
import { simulationApi, scriptApi, sceneApi, npcApi, strategyApi, clueApi } from '@/api';
import type { Script, Scene, NPC, AlgorithmStrategy, Clue, SimulationResult, MatchedClue } from '@/types';

const { Option } = Select;
const { TextArea } = Input;

interface ChatMessage {
  role: 'player' | 'system';
  content: string;
  result?: SimulationResult;
}

export default function DialogueSimulation() {
  const { t } = useTranslation();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [strategies, setStrategies] = useState<AlgorithmStrategy[]>([]);
  const [clues, setClues] = useState<Clue[]>([]);

  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [unlockedClueIds, setUnlockedClueIds] = useState<string[]>([]);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [playerMessage, setPlayerMessage] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [scriptsData, strategiesData] = await Promise.all([
          scriptApi.list({}),
          strategyApi.list({ status: 'published' }),
        ]);
        setScripts(scriptsData.items);
        setStrategies(strategiesData.items);
      } catch {
        // Error handled
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedScriptId) {
      Promise.all([
        sceneApi.list({ script_id: selectedScriptId }),
        npcApi.list({ script_id: selectedScriptId, page_size: 100 }),
        clueApi.list({ script_id: selectedScriptId, page_size: 500 }),
      ]).then(([scenesData, npcsData, cluesData]) => {
        setScenes(scenesData.items);
        setNpcs(npcsData.items);
        setClues(cluesData.items);
      });
    }
  }, [selectedScriptId]);

  const handleSimulate = async () => {
    if (!selectedScriptId || !selectedNpcId || !selectedStrategyId || !playerMessage.trim()) {
      message.warning(t('debug.fillAllFields'));
      return;
    }

    setLoading(true);
    const newMessage: ChatMessage = { role: 'player', content: playerMessage };
    setChatHistory((prev) => [...prev, newMessage]);

    try {
      const result = await simulationApi.run({
        script_id: selectedScriptId,
        scene_id: selectedSceneId || '',
        npc_id: selectedNpcId,
        strategy_id: selectedStrategyId,
        unlocked_clue_ids: unlockedClueIds,
        player_message: playerMessage,
      });

      const systemMessage: ChatMessage = {
        role: 'system',
        content: `Found ${result.matched_clues.length} matching clues`,
        result,
      };
      setChatHistory((prev) => [...prev, systemMessage]);

      // Auto-unlock matched clues
      const newUnlockedIds = result.final_clue_list.map((c) => c.id);
      setUnlockedClueIds((prev) => [...new Set([...prev, ...newUnlockedIds])]);

      setPlayerMessage('');
    } catch {
      message.error(t('debug.simulationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setChatHistory([]);
    setUnlockedClueIds([]);
  };

  const matchedClueColumns: TableProps<MatchedClue>['columns'] = [
    {
      title: 'Clue',
      dataIndex: 'clue_id',
      key: 'clue_id',
      render: (id) => {
        const clue = clues.find((c) => c.id === id);
        return clue?.title_internal || id;
      },
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      render: (score) => <Progress percent={Math.round(score * 100)} size="small" />,
    },
    {
      title: 'Match Type',
      dataIndex: 'match_type',
      key: 'match_type',
      width: 100,
      render: (type) => (
        <Tag color={type === 'keyword' ? 'blue' : type === 'semantic' ? 'green' : 'purple'}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Keywords',
      dataIndex: 'keyword_matches',
      key: 'keyword_matches',
      render: (keywords) =>
        keywords?.length > 0 ? (
          <Space size={[0, 4]} wrap>
            {keywords.map((kw: string, i: number) => (
              <Tag key={i} color="blue">
                {kw}
              </Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: 'Similarity',
      dataIndex: 'embedding_similarity',
      key: 'embedding_similarity',
      width: 100,
      render: (sim) => (sim ? `${(sim * 100).toFixed(1)}%` : '-'),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('debug.simulation')}
        subtitle={t('debug.simulationSubtitle')}
      />

      <Row gutter={24}>
        <Col span={8}>
          <Card title={t('debug.configuration')} size="small">
            <Form layout="vertical">
              <Form.Item label="Script" required>
                <Select
                  placeholder="Select script"
                  value={selectedScriptId}
                  onChange={(v) => {
                    setSelectedScriptId(v);
                    setSelectedSceneId(null);
                    setSelectedNpcId(null);
                    setUnlockedClueIds([]);
                  }}
                >
                  {scripts.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {s.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="Scene">
                <Select
                  placeholder="Select scene (optional)"
                  value={selectedSceneId}
                  onChange={setSelectedSceneId}
                  allowClear
                  disabled={!selectedScriptId}
                >
                  {scenes.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {s.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="NPC" required>
                <Select
                  placeholder="Select NPC"
                  value={selectedNpcId}
                  onChange={setSelectedNpcId}
                  disabled={!selectedScriptId}
                >
                  {npcs.map((n) => (
                    <Option key={n.id} value={n.id}>
                      {n.name} ({n.role_type})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="Algorithm Strategy" required>
                <Select
                  placeholder="Select strategy"
                  value={selectedStrategyId}
                  onChange={setSelectedStrategyId}
                >
                  {strategies.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {s.name} {s.is_default && '(default)'}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Divider />
              <Form.Item
                label={`Unlocked Clues (${unlockedClueIds.length})`}
                extra="Specify which clues are already unlocked"
              >
                <Select
                  mode="multiple"
                  placeholder="Select unlocked clues"
                  value={unlockedClueIds}
                  onChange={setUnlockedClueIds}
                  maxTagCount={3}
                  disabled={!selectedScriptId}
                >
                  {clues.map((c) => (
                    <Option key={c.id} value={c.id}>
                      {c.title_internal}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col span={16}>
          <Card
            title={t('debug.simulationChat')}
            size="small"
            extra={
              <Button icon={<ClearOutlined />} onClick={handleClearHistory}>
                {t('debug.clear')}
              </Button>
            }
          >
            <div
              style={{
                height: 400,
                overflowY: 'auto',
                padding: 16,
                background: '#fafafa',
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              {chatHistory.length === 0 ? (
                <Empty description="Start by entering a player message" />
              ) : (
                chatHistory.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      marginBottom: 16,
                      textAlign: msg.role === 'player' ? 'right' : 'left',
                    }}
                  >
                    <Tag color={msg.role === 'player' ? 'blue' : 'green'}>
                      {msg.role === 'player' ? 'Player' : 'System'}
                    </Tag>
                    <div
                      style={{
                        display: 'inline-block',
                        maxWidth: '80%',
                        padding: '8px 12px',
                        background: msg.role === 'player' ? '#1890ff' : '#f0f0f0',
                        color: msg.role === 'player' ? '#fff' : '#000',
                        borderRadius: 8,
                        textAlign: 'left',
                        marginTop: 4,
                      }}
                    >
                      {msg.content}
                    </div>
                    {msg.result && (
                      <div style={{ marginTop: 8, textAlign: 'left' }}>
                        <Collapse
                          size="small"
                          items={[
                            {
                              key: 'details',
                              label: `Match Details (${msg.result.matched_clues.length} clues)`,
                              children: (
                                <div>
                                  <Table
                                    columns={matchedClueColumns}
                                    dataSource={msg.result.matched_clues}
                                    rowKey="clue_id"
                                    size="small"
                                    pagination={false}
                                  />
                                  <Divider />
                                  <Descriptions size="small" column={2}>
                                    <Descriptions.Item label="Processing Time">
                                      {msg.result.debug_info.total_processing_time_ms}ms
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Final Clues">
                                      {msg.result.final_clue_list.length}
                                    </Descriptions.Item>
                                  </Descriptions>
                                </div>
                              ),
                            },
                          ]}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <Space.Compact style={{ width: '100%' }}>
              <TextArea
                placeholder="Enter player message..."
                value={playerMessage}
                onChange={(e) => setPlayerMessage(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSimulate();
                  }
                }}
                autoSize={{ minRows: 1, maxRows: 3 }}
                style={{ width: 'calc(100% - 100px)' }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={loading}
                onClick={handleSimulate}
                style={{ width: 100 }}
              >
                Send
              </Button>
            </Space.Compact>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
