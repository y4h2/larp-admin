import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Spin,
  Empty,
  Modal,
  message,
  Typography,
  Collapse,
} from 'antd';
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  HistoryOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';
import { clueApi, npcApi, sceneApi } from '@/api';
import { useScripts, useClueVersions } from '@/hooks';
import { formatDate } from '@/utils';
import type { Clue, ClueVersion, NPC, Scene, KeywordCondition } from '@/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

export default function ClueDetail() {
  const { t } = useTranslation();
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
        semantic_threshold: clueData.unlock_conditions?.semantic_conditions?.similarity_threshold,
        semantic_queries: clueData.unlock_conditions?.semantic_conditions?.target_queries,
        prerequisite_clue_ids: clueData.unlock_conditions?.state_conditions?.prerequisite_clue_ids,
        stage_lock: clueData.unlock_conditions?.state_conditions?.stage_lock,
      });

      // Set unlock conditions state
      setKeywordLists(clueData.unlock_conditions?.text_conditions?.keyword_lists || []);
      setBlacklist(clueData.unlock_conditions?.text_conditions?.blacklist || []);
      setSemanticEnabled(!!clueData.unlock_conditions?.semantic_conditions);
      setStateEnabled(!!clueData.unlock_conditions?.state_conditions);

      // Fetch related data
      const [npcsData, scenesData, cluesData] = await Promise.all([
        npcApi.list({ script_id: clueData.script_id, page_size: 100 }),
        sceneApi.list({ script_id: clueData.script_id }),
        clueApi.list({ script_id: clueData.script_id, page_size: 100 }),
      ]);
      setNpcs(npcsData.items);
      setScenes(scenesData.items);
      setAllClues(cluesData.items.filter((c) => c.id !== id));
    } catch {
      message.error(t('common.loadFailed'));
      navigate('/clues');
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate, t]);

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
        clueApi.list({ script_id: selectedScriptId, page_size: 100 }),
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
        detail_for_npc: values.detail_for_npc as string | undefined,
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
      message.success(t('common.saveSuccess'));
    } catch {
      message.error(t('common.saveFailed'));
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
      title: t('clue.restoreVersion'),
      content: t('clue.restoreConfirm'),
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

  const versionColumns: ResizableColumn<ClueVersion>[] = [
    {
      title: t('common.version'),
      dataIndex: 'version',
      key: 'version',
      render: (v) => `v${v}`,
    },
    {
      title: t('clue.modifiedBy'),
      dataIndex: 'created_by',
      key: 'created_by',
    },
    {
      title: t('clue.date'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => formatDate(date),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record) => (
        <Button
          type="link"
          icon={<RollbackOutlined />}
          onClick={() => handleRestoreVersion(record.id)}
          disabled={record.version === clue?.version}
        >
          {t('clue.restore')}
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
    return <Empty description={t('clue.notFound')} />;
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
              {t('clue.versionHistory')}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => form.submit()}
            >
              {t('common.save')}
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
              label: t('common.basicInfo'),
              children: (
                <Card>
                  <Row gutter={24}>
                    <Col span={12}>
                      <Form.Item
                        name="title_internal"
                        label={t('clue.internalTitle')}
                        rules={[{ required: true }]}
                      >
                        <Input placeholder={t('clue.internalTitlePlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="title_player"
                        label={t('clue.playerTitle')}
                        rules={[{ required: true }]}
                      >
                        <Input placeholder={t('clue.playerTitlePlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        name="content_text"
                        label={t('clue.content')}
                        rules={[{ required: true }]}
                      >
                        <TextArea rows={4} placeholder={t('clue.contentPlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        name="detail_for_npc"
                        label={t('clue.detailForNpc')}
                        extra={t('clue.detailForNpcExtra')}
                      >
                        <TextArea rows={3} placeholder={t('clue.detailForNpcPlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="clue_type" label={t('clue.type')} rules={[{ required: true }]}>
                        <Select>
                          <Option value="evidence">{t('clue.evidence')}</Option>
                          <Option value="testimony">{t('clue.testimony')}</Option>
                          <Option value="world_info">{t('clue.worldInfo')}</Option>
                          <Option value="decoy">{t('clue.decoy')}</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="importance" label={t('clue.importance')} rules={[{ required: true }]}>
                        <Select>
                          <Option value="critical">{t('clue.critical')}</Option>
                          <Option value="major">{t('clue.major')}</Option>
                          <Option value="minor">{t('clue.minor')}</Option>
                          <Option value="easter_egg">{t('clue.easterEgg')}</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="stage" label={t('clue.stage')}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="content_type" label={t('clue.contentType')}>
                        <Select>
                          <Option value="text">{t('common.text')}</Option>
                          <Option value="image">{t('common.image')}</Option>
                          <Option value="structured">{t('common.structured')}</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="script_id" label={t('script.title')} rules={[{ required: true }]}>
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
                      <Form.Item name="scene_id" label={t('common.scene')}>
                        <Select allowClear placeholder={t('common.optional')}>
                          {scenes.map((s) => (
                            <Option key={s.id} value={s.id}>
                              {s.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="status" label={t('common.status')}>
                        <Select>
                          <Option value="draft">{t('clue.draft')}</Option>
                          <Option value="active">{t('clue.active')}</Option>
                          <Option value="disabled">{t('clue.disabled')}</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="npc_ids" label={t('clue.associatedNpcs')}>
                        <Select mode="multiple" placeholder={t('clue.selectNpc')}>
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
              label: t('clue.unlockConditions'),
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <Card title={t('clue.textConditions')}>
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
                                <Option value="must">{t('clue.mustMatch')}</Option>
                                <Option value="should">{t('clue.shouldMatch')}</Option>
                              </Select>
                            </Space>
                            <Select
                              mode="tags"
                              value={condition.keywords}
                              onChange={(v) => updateKeywordCondition(index, { keywords: v })}
                              placeholder={t('clue.enterKeywords')}
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
                      {t('clue.addKeywordCondition')}
                    </Button>

                    <Divider />

                    <Form.Item label={t('clue.blacklistKeywords')}>
                      <Select
                        mode="tags"
                        value={blacklist}
                        onChange={setBlacklist}
                        placeholder={t('clue.blacklistPlaceholder')}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Card>

                  <Card
                    title={
                      <Space>
                        <span>{t('clue.semanticConditions')}</span>
                        <Switch
                          checked={semanticEnabled}
                          onChange={setSemanticEnabled}
                          checkedChildren={t('clue.enabled')}
                          unCheckedChildren={t('clue.disabled')}
                        />
                      </Space>
                    }
                  >
                    {semanticEnabled && (
                      <Row gutter={24}>
                        <Col span={24}>
                          <Form.Item
                            name="semantic_queries"
                            label={t('clue.targetQueries')}
                            extra={t('clue.targetQueriesExtra')}
                          >
                            <Select
                              mode="tags"
                              placeholder={t('clue.enterTargetQueries')}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            name="semantic_threshold"
                            label={t('clue.similarityThreshold')}
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
                        <span>{t('clue.stateConditions')}</span>
                        <Switch
                          checked={stateEnabled}
                          onChange={setStateEnabled}
                          checkedChildren={t('clue.enabled')}
                          unCheckedChildren={t('clue.disabled')}
                        />
                      </Space>
                    }
                  >
                    {stateEnabled && (
                      <Row gutter={24}>
                        <Col span={16}>
                          <Form.Item
                            name="prerequisite_clue_ids"
                            label={t('clue.prerequisiteClues')}
                            extra={t('clue.prerequisiteCluesExtra')}
                          >
                            <Select
                              mode="multiple"
                              placeholder={t('clue.selectPrerequisiteClues')}
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
                            label={t('clue.minimumStage')}
                            extra={t('clue.minimumStageExtra')}
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
              label: t('clue.triggerEffects'),
              children: (
                <Card>
                  <Row gutter={24}>
                    <Col span={24}>
                      <Form.Item
                        name="display_text"
                        label={t('clue.displayText')}
                        extra={t('clue.displayTextExtra')}
                        initialValue={clue.effects?.display_text}
                      >
                        <TextArea rows={4} placeholder={t('clue.displayTextPlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="one_time_trigger"
                        label={t('clue.oneTimeTrigger')}
                        valuePropName="checked"
                        initialValue={clue.effects?.one_time_trigger}
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
        title={t('clue.versionHistory')}
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        footer={null}
        width={700}
      >
        <ResizableTable
          columns={versionColumns}
          dataSource={versions}
          rowKey="id"
          pagination={false}
        />
      </Modal>
    </div>
  );
}
