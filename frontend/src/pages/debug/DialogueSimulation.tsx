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
  Descriptions,
  Divider,
  Progress,
  Collapse,
  Empty,
  message,
  Tabs,
} from 'antd';
import {
  SendOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';
import { TemplateEditor, TemplatePreview, TemplateSelector } from '@/components/templates';
import { simulationApi, scriptApi, sceneApi, npcApi, strategyApi, clueApi, templateApi } from '@/api';
import type { Script, Scene, NPC, AlgorithmStrategy, Clue, SimulationResult, MatchedClue } from '@/types';
import type { PromptTemplate } from '@/api/templates';

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

  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [templateContent, setTemplateContent] = useState('');
  const [activeTab, setActiveTab] = useState<string>('simulation');

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
        clueApi.list({ script_id: selectedScriptId, page_size: 100 }),
      ]).then(([scenesData, npcsData, cluesData]) => {
        setScenes(scenesData.items);
        setNpcs(npcsData.items);
        setClues(cluesData.items);
      });
    }
  }, [selectedScriptId]);

  // Build template context from current selections
  const templateContext = useMemo(() => {
    const script = scripts.find((s) => s.id === selectedScriptId);
    const scene = scenes.find((s) => s.id === selectedSceneId);
    const npc = npcs.find((n) => n.id === selectedNpcId);
    const strategy = strategies.find((s) => s.id === selectedStrategyId);
    const unlockedClues = clues.filter((c) => unlockedClueIds.includes(c.id));

    return {
      player_input: playerMessage,
      script: script
        ? {
            id: script.id,
            name: script.name,
            description: script.description,
          }
        : null,
      scene: scene
        ? {
            id: scene.id,
            name: scene.name,
            description: scene.description,
          }
        : null,
      npc: npc
        ? {
            id: npc.id,
            name: npc.name,
            role_type: npc.role_type,
            personality: npc.personality,
            speech_style: npc.speech_style,
            background_story: npc.background_story,
            relations: npc.relations,
          }
        : null,
      strategy: strategy
        ? {
            id: strategy.id,
            name: strategy.name,
          }
        : null,
      unlocked_clues: unlockedClues.map((c) => ({
        id: c.id,
        title_internal: c.title_internal,
        title_player: c.title_player,
        content_text: c.content_text,
        clue_type: c.clue_type,
        importance: c.importance,
        stage: c.stage,
      })),
      candidate_clues: [],
      now: new Date().toISOString(),
    };
  }, [
    scripts,
    scenes,
    npcs,
    strategies,
    clues,
    selectedScriptId,
    selectedSceneId,
    selectedNpcId,
    selectedStrategyId,
    unlockedClueIds,
    playerMessage,
  ]);

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

  const handleTemplateSelect = (_templateId: string | undefined, template?: PromptTemplate) => {
    setSelectedTemplateId(template?.id);
  };

  const handleTemplateLoad = (content: string) => {
    setTemplateContent(content);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplateId) {
      message.warning(t('template.selectTemplateFirst'));
      return;
    }
    try {
      await templateApi.update(selectedTemplateId, { content: templateContent });
      message.success(t('common.saveSuccess'));
    } catch {
      message.error(t('common.saveFailed'));
    }
  };

  const matchedClueColumns: ResizableColumn<MatchedClue>[] = [
    {
      title: t('debug.clue'),
      dataIndex: 'clue_id',
      key: 'clue_id',
      render: (id) => {
        const clue = clues.find((c) => c.id === id);
        return clue?.title_internal || id;
      },
    },
    {
      title: t('debug.score'),
      dataIndex: 'score',
      key: 'score',
      width: 100,
      render: (score) => <Progress percent={Math.round(score * 100)} size="small" />,
    },
    {
      title: t('debug.matchType'),
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
      title: t('debug.keywords'),
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
      title: t('debug.similarity'),
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

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'simulation',
            label: t('debug.simulationChat'),
            children: (
              <Row gutter={24}>
                <Col span={8}>
                  <Card title={t('debug.configuration')} size="small">
                    <Form layout="vertical">
                      <Form.Item label={t('script.title')} required>
                        <Select
                          placeholder={t('debug.selectScript')}
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
                      <Form.Item label={t('scene.title')}>
                        <Select
                          placeholder={t('debug.selectScene')}
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
                      <Form.Item label={t('npc.title')} required>
                        <Select
                          placeholder={t('debug.selectNpc')}
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
                      <Form.Item label={t('algorithm.strategy')} required>
                        <Select
                          placeholder={t('debug.selectStrategy')}
                          value={selectedStrategyId}
                          onChange={setSelectedStrategyId}
                        >
                          {strategies.map((s) => (
                            <Option key={s.id} value={s.id}>
                              {s.name} {s.is_default && `(${t('strategy.default')})`}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Divider />
                      <Form.Item
                        label={`${t('debug.unlockedClues')} (${unlockedClueIds.length})`}
                        extra={t('debug.unlockedCluesExtra')}
                      >
                        <Select
                          mode="multiple"
                          placeholder={t('clue.selectPrerequisiteClues')}
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
                        <Empty description={t('debug.startMessage')} />
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
                              {msg.role === 'player' ? t('debug.player') : t('debug.system')}
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
                                      label: `${t('debug.matchDetails')} (${msg.result.matched_clues.length} ${t('logs.clues')})`,
                                      children: (
                                        <div>
                                          <ResizableTable
                                            columns={matchedClueColumns}
                                            dataSource={msg.result.matched_clues}
                                            rowKey="clue_id"
                                            size="small"
                                            pagination={false}
                                          />
                                          <Divider />
                                          <Descriptions size="small" column={2}>
                                            <Descriptions.Item label={t('debug.processingTime')}>
                                              {msg.result.debug_info.total_processing_time_ms}ms
                                            </Descriptions.Item>
                                            <Descriptions.Item label={t('debug.finalClues')}>
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
                        placeholder={t('debug.enterPlayerMessage')}
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
                        {t('debug.send')}
                      </Button>
                    </Space.Compact>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'template',
            label: t('template.configuration'),
            children: (
              <Row gutter={24}>
                <Col span={8}>
                  <Card title={t('template.contextSelection')} size="small" style={{ marginBottom: 16 }}>
                    <Form layout="vertical" size="small">
                      <Form.Item label={t('script.title')} style={{ marginBottom: 12 }}>
                        <Select
                          placeholder={t('debug.selectScript')}
                          value={selectedScriptId}
                          onChange={(v) => {
                            setSelectedScriptId(v);
                            setSelectedSceneId(null);
                            setSelectedNpcId(null);
                            setUnlockedClueIds([]);
                          }}
                          allowClear
                        >
                          {scripts.map((s) => (
                            <Option key={s.id} value={s.id}>
                              {s.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item label={t('scene.title')} style={{ marginBottom: 12 }}>
                        <Select
                          placeholder={t('debug.selectScene')}
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
                      <Form.Item label={t('npc.title')} style={{ marginBottom: 12 }}>
                        <Select
                          placeholder={t('debug.selectNpc')}
                          value={selectedNpcId}
                          onChange={setSelectedNpcId}
                          allowClear
                          disabled={!selectedScriptId}
                        >
                          {npcs.map((n) => (
                            <Option key={n.id} value={n.id}>
                              {n.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item label={t('debug.unlockedClues')} style={{ marginBottom: 12 }}>
                        <Select
                          mode="multiple"
                          placeholder={t('clue.selectPrerequisiteClues')}
                          value={unlockedClueIds}
                          onChange={setUnlockedClueIds}
                          maxTagCount={2}
                          disabled={!selectedScriptId}
                        >
                          {clues.map((c) => (
                            <Option key={c.id} value={c.id}>
                              {c.title_internal}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item label={t('debug.playerMessage')} style={{ marginBottom: 0 }}>
                        <Input.TextArea
                          placeholder={t('debug.enterPlayerMessage')}
                          value={playerMessage}
                          onChange={(e) => setPlayerMessage(e.target.value)}
                          rows={2}
                        />
                      </Form.Item>
                    </Form>
                  </Card>
                  <TemplatePreview
                    templateContent={templateContent}
                    context={templateContext}
                    autoRender={false}
                  />
                </Col>
                <Col span={16}>
                  <Card
                    title={t('template.editor')}
                    size="small"
                    extra={
                      <Space>
                        <TemplateSelector
                          type="npc_dialog"
                          value={selectedTemplateId}
                          onChange={handleTemplateSelect}
                          onTemplateLoad={handleTemplateLoad}
                        />
                        <Button type="primary" onClick={handleSaveTemplate} disabled={!selectedTemplateId}>
                          {t('common.save')}
                        </Button>
                      </Space>
                    }
                  >
                    <TemplateEditor
                      value={templateContent}
                      onChange={setTemplateContent}
                      placeholder={t('template.editorPlaceholder')}
                      showVariablePanel={true}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
}
