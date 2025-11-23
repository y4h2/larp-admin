import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tabs,
  Switch,
  InputNumber,
  Row,
  Col,
  Divider,
  Tag,
  Table,
  Spin,
  Empty,
  Modal,
  message,
  Typography,
  Collapse,
} from 'antd';
import type { TableProps } from 'antd';
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  HistoryOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/common';
import { clueApi, npcApi, sceneApi } from '@/api';
import { useScripts, useClueVersions } from '@/hooks';
import { formatDate } from '@/utils';
import type { Clue, ClueVersion, NPC, Scene, KeywordCondition } from '@/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

export default function ClueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const { scripts, fetchScripts } = useScripts();
  const { versions, fetchVersions, restoreVersion } = useClueVersions();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clue, setClue] = useState<Clue | null>(null);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [allClues, setAllClues] = useState<Clue[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [versionModalVisible, setVersionModalVisible] = useState(false);

  // Unlock conditions state
  const [keywordLists, setKeywordLists] = useState<KeywordCondition[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [semanticEnabled, setSemanticEnabled] = useState(false);
  const [stateEnabled, setStateEnabled] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const clueData = await clueApi.get(id);
      setClue(clueData);
      setSelectedScriptId(clueData.script_id);
      form.setFieldsValue({
        ...clueData,
        semantic_threshold: clueData.unlock_conditions.semantic_conditions?.similarity_threshold,
        semantic_queries: clueData.unlock_conditions.semantic_conditions?.target_queries,
        prerequisite_clue_ids: clueData.unlock_conditions.state_conditions?.prerequisite_clue_ids,
        stage_lock: clueData.unlock_conditions.state_conditions?.stage_lock,
      });

      // Set unlock conditions state
      setKeywordLists(clueData.unlock_conditions.text_conditions.keyword_lists);
      setBlacklist(clueData.unlock_conditions.text_conditions.blacklist);
      setSemanticEnabled(!!clueData.unlock_conditions.semantic_conditions);
      setStateEnabled(!!clueData.unlock_conditions.state_conditions);

      // Fetch related data
      const [npcsData, scenesData, cluesData] = await Promise.all([
        npcApi.list({ script_id: clueData.script_id, page_size: 100 }),
        sceneApi.list({ script_id: clueData.script_id }),
        clueApi.list({ script_id: clueData.script_id, page_size: 500 }),
      ]);
      setNpcs(npcsData.items);
      setScenes(scenesData.items);
      setAllClues(cluesData.items.filter((c) => c.id !== id));
    } catch {
      message.error('Failed to load clue');
      navigate('/clues');
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedScriptId && selectedScriptId !== clue?.script_id) {
      Promise.all([
        npcApi.list({ script_id: selectedScriptId, page_size: 100 }),
        sceneApi.list({ script_id: selectedScriptId }),
        clueApi.list({ script_id: selectedScriptId, page_size: 500 }),
      ]).then(([npcsData, scenesData, cluesData]) => {
        setNpcs(npcsData.items);
        setScenes(scenesData.items);
        setAllClues(cluesData.items.filter((c) => c.id !== id));
      });
    }
  }, [selectedScriptId, clue?.script_id, id]);

  const handleSave = async (values: Record<string, unknown>) => {
    if (!id) return;
    setSaving(true);
    try {
      const updateData: Partial<Clue> = {
        title_internal: values.title_internal as string,
        title_player: values.title_player as string,
        content_text: values.content_text as string,
        content_type: values.content_type as Clue['content_type'],
        clue_type: values.clue_type as Clue['clue_type'],
        importance: values.importance as Clue['importance'],
        stage: values.stage as number,
        npc_ids: values.npc_ids as string[],
        script_id: values.script_id as string,
        scene_id: values.scene_id as string | null,
        status: values.status as Clue['status'],
        unlock_conditions: {
          text_conditions: {
            keyword_lists: keywordLists,
            blacklist: blacklist,
          },
          semantic_conditions: semanticEnabled
            ? {
                target_queries: (values.semantic_queries as string[]) || [],
                similarity_threshold: (values.semantic_threshold as number) || 0.8,
              }
            : null,
          state_conditions: stateEnabled
            ? {
                prerequisite_clue_ids: (values.prerequisite_clue_ids as string[]) || [],
                player_state_requirements: {},
                stage_lock: values.stage_lock as number | undefined,
              }
            : null,
        },
        effects: {
          display_text: (values.display_text as string) || '',
          game_state_updates: {},
          one_time_trigger: (values.one_time_trigger as boolean) || false,
        },
      };

      const updated = await clueApi.update(id, updateData);
      setClue(updated);
      message.success('Clue saved successfully');
    } catch {
      message.error('Failed to save clue');
    } finally {
      setSaving(false);
    }
  };

  const addKeywordCondition = () => {
    setKeywordLists([...keywordLists, { keywords: [], logic: 'OR', requirement: 'should' }]);
  };

  const updateKeywordCondition = (index: number, updates: Partial<KeywordCondition>) => {
    const newList = [...keywordLists];
    newList[index] = { ...newList[index], ...updates };
    setKeywordLists(newList);
  };

  const removeKeywordCondition = (index: number) => {
    setKeywordLists(keywordLists.filter((_, i) => i !== index));
  };

  const handleViewVersions = async () => {
    if (!id) return;
    await fetchVersions(id);
    setVersionModalVisible(true);
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!id) return;
    Modal.confirm({
      title: 'Restore Version',
      content: 'Are you sure you want to restore this version? Current changes will be overwritten.',
      onOk: async () => {
        try {
          await restoreVersion(id, versionId);
          setVersionModalVisible(false);
          fetchData();
        } catch {
          // Error handled in hook
        }
      },
    });
  };

  const versionColumns: TableProps<ClueVersion>['columns'] = [
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      render: (v) => `v${v}`,
    },
    {
      title: 'Modified By',
      dataIndex: 'created_by',
      key: 'created_by',
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => formatDate(date),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="link"
          icon={<RollbackOutlined />}
          onClick={() => handleRestoreVersion(record.id)}
          disabled={record.version === clue?.version}
        >
          Restore
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!clue) {
    return <Empty description="Clue not found" />;
  }

  return (
    <div>
      <PageHeader
        title={clue.title_internal}
        subtitle={`${clue.clue_type} - ${clue.importance} - ${clue.status} - v${clue.version}`}
        breadcrumbs={[
          { title: 'Clues', path: '/clues' },
          { title: clue.title_internal },
        ]}
        extra={
          <Space>
            <Button icon={<HistoryOutlined />} onClick={handleViewVersions}>
              Version History
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => form.submit()}
            >
              Save
            </Button>
          </Space>
        }
      />

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Tabs
          defaultActiveKey="basic"
          items={[
            {
              key: 'basic',
              label: 'Basic Info',
              children: (
                <Card>
                  <Row gutter={24}>
                    <Col span={12}>
                      <Form.Item
                        name="title_internal"
                        label="Internal Title"
                        rules={[{ required: true }]}
                      >
                        <Input placeholder="For internal reference" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="title_player"
                        label="Player Title"
                        rules={[{ required: true }]}
                      >
                        <Input placeholder="Title shown to players" />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        name="content_text"
                        label="Content"
                        rules={[{ required: true }]}
                      >
                        <TextArea rows={4} placeholder="Clue content" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="clue_type" label="Type" rules={[{ required: true }]}>
                        <Select>
                          <Option value="evidence">Evidence</Option>
                          <Option value="testimony">Testimony</Option>
                          <Option value="world_info">World Info</Option>
                          <Option value="decoy">Decoy</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="importance" label="Importance" rules={[{ required: true }]}>
                        <Select>
                          <Option value="critical">Critical</Option>
                          <Option value="major">Major</Option>
                          <Option value="minor">Minor</Option>
                          <Option value="easter_egg">Easter Egg</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="stage" label="Stage">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="content_type" label="Content Type">
                        <Select>
                          <Option value="text">Text</Option>
                          <Option value="image">Image</Option>
                          <Option value="structured">Structured</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="script_id" label="Script" rules={[{ required: true }]}>
                        <Select
                          onChange={(value) => {
                            setSelectedScriptId(value);
                            form.setFieldValue('scene_id', null);
                            form.setFieldValue('npc_ids', []);
                          }}
                        >
                          {scripts.map((s) => (
                            <Option key={s.id} value={s.id}>
                              {s.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="scene_id" label="Scene">
                        <Select allowClear placeholder="Optional">
                          {scenes.map((s) => (
                            <Option key={s.id} value={s.id}>
                              {s.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="status" label="Status">
                        <Select>
                          <Option value="draft">Draft</Option>
                          <Option value="active">Active</Option>
                          <Option value="disabled">Disabled</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="npc_ids" label="Associated NPCs">
                        <Select mode="multiple" placeholder="Select NPCs">
                          {npcs.map((n) => (
                            <Option key={n.id} value={n.id}>
                              {n.name} ({n.role_type})
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ),
            },
            {
              key: 'conditions',
              label: 'Unlock Conditions',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <Card title="Text Conditions (Keywords)">
                    <Collapse
                      items={keywordLists.map((condition, index) => ({
                        key: index,
                        label: (
                          <Space>
                            <Tag color={condition.requirement === 'must' ? 'red' : 'blue'}>
                              {condition.requirement.toUpperCase()}
                            </Tag>
                            <Tag>{condition.logic}</Tag>
                            <Text>{condition.keywords.length} keywords</Text>
                          </Space>
                        ),
                        extra: (
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeKeywordCondition(index);
                            }}
                          />
                        ),
                        children: (
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Space>
                              <Select
                                value={condition.logic}
                                onChange={(v) => updateKeywordCondition(index, { logic: v })}
                                style={{ width: 100 }}
                              >
                                <Option value="AND">AND</Option>
                                <Option value="OR">OR</Option>
                              </Select>
                              <Select
                                value={condition.requirement}
                                onChange={(v) => updateKeywordCondition(index, { requirement: v })}
                                style={{ width: 120 }}
                              >
                                <Option value="must">Must Match</Option>
                                <Option value="should">Should Match</Option>
                              </Select>
                            </Space>
                            <Select
                              mode="tags"
                              value={condition.keywords}
                              onChange={(v) => updateKeywordCondition(index, { keywords: v })}
                              placeholder="Enter keywords and press Enter"
                              style={{ width: '100%' }}
                            />
                          </Space>
                        ),
                      }))}
                    />
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={addKeywordCondition}
                      style={{ marginTop: 16 }}
                    >
                      Add Keyword Condition
                    </Button>

                    <Divider />

                    <Form.Item label="Blacklist Keywords">
                      <Select
                        mode="tags"
                        value={blacklist}
                        onChange={setBlacklist}
                        placeholder="Keywords that should NOT trigger this clue"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Card>

                  <Card
                    title={
                      <Space>
                        <span>Semantic Conditions</span>
                        <Switch
                          checked={semanticEnabled}
                          onChange={setSemanticEnabled}
                          checkedChildren="Enabled"
                          unCheckedChildren="Disabled"
                        />
                      </Space>
                    }
                  >
                    {semanticEnabled && (
                      <Row gutter={24}>
                        <Col span={24}>
                          <Form.Item
                            name="semantic_queries"
                            label="Target Queries"
                            extra="Questions/phrases that should semantically match to unlock this clue"
                          >
                            <Select
                              mode="tags"
                              placeholder="Enter target queries"
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            name="semantic_threshold"
                            label="Similarity Threshold"
                            initialValue={0.8}
                          >
                            <InputNumber
                              min={0}
                              max={1}
                              step={0.05}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}
                  </Card>

                  <Card
                    title={
                      <Space>
                        <span>State Conditions</span>
                        <Switch
                          checked={stateEnabled}
                          onChange={setStateEnabled}
                          checkedChildren="Enabled"
                          unCheckedChildren="Disabled"
                        />
                      </Space>
                    }
                  >
                    {stateEnabled && (
                      <Row gutter={24}>
                        <Col span={16}>
                          <Form.Item
                            name="prerequisite_clue_ids"
                            label="Prerequisite Clues"
                            extra="Clues that must be unlocked before this one"
                          >
                            <Select
                              mode="multiple"
                              placeholder="Select prerequisite clues"
                              style={{ width: '100%' }}
                              optionFilterProp="children"
                            >
                              {allClues.map((c) => (
                                <Option key={c.id} value={c.id}>
                                  {c.title_internal}
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            name="stage_lock"
                            label="Minimum Stage"
                            extra="Player must reach this stage"
                          >
                            <InputNumber min={1} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}
                  </Card>
                </Space>
              ),
            },
            {
              key: 'effects',
              label: 'Trigger Effects',
              children: (
                <Card>
                  <Row gutter={24}>
                    <Col span={24}>
                      <Form.Item
                        name="display_text"
                        label="Display Text"
                        extra="Custom text to show when clue is unlocked (leave empty to use content)"
                        initialValue={clue.effects.display_text}
                      >
                        <TextArea rows={4} placeholder="Custom display text" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="one_time_trigger"
                        label="One-time Trigger"
                        valuePropName="checked"
                        initialValue={clue.effects.one_time_trigger}
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ),
            },
          ]}
        />
      </Form>

      <Modal
        title="Version History"
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        footer={null}
        width={700}
      >
        <Table
          columns={versionColumns}
          dataSource={versions}
          rowKey="id"
          pagination={false}
        />
      </Modal>
    </div>
  );
}
