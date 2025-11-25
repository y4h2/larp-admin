import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Tabs,
  Spin,
  Empty,
  Row,
  Col,
  message,
  Typography,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, StatusTag, ClueTypeTag, ImportanceTag, ResizableTable, type ResizableColumn } from '@/components/common';
import { npcApi, clueApi } from '@/api';
import { useScripts, useScenes } from '@/hooks';
import type { NPC, Clue } from '@/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

export default function NpcDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const { scripts, fetchScripts } = useScripts();
  const { scenes, fetchScenes } = useScenes();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [npc, setNpc] = useState<NPC | null>(null);
  const [relatedClues, setRelatedClues] = useState<Clue[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [npcData, cluesData] = await Promise.all([
        npcApi.get(id),
        clueApi.list({ npc_id: id, page_size: 100 }),
      ]);
      setNpc(npcData);
      setRelatedClues(cluesData.items);
      setSelectedScriptId(npcData.script_id);
      form.setFieldsValue(npcData);
    } catch {
      message.error(t('common.loadFailed'));
      navigate('/npcs');
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate, t]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    if (selectedScriptId) {
      fetchScenes({ script_id: selectedScriptId });
    }
  }, [selectedScriptId, fetchScenes]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (values: Partial<NPC>) => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await npcApi.update(id, values);
      setNpc(updated);
      message.success(t('common.saveSuccess'));
    } catch {
      message.error(t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const clueColumns: ResizableColumn<Clue>[] = [
    {
      title: t('clue.internalTitle'),
      dataIndex: 'title_internal',
      key: 'title_internal',
      render: (text, record) => (
        <a onClick={() => navigate(`/clues/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: t('clue.type'),
      dataIndex: 'clue_type',
      key: 'clue_type',
      width: 100,
      render: (type) => <ClueTypeTag type={type} />,
    },
    {
      title: t('clue.importance'),
      dataIndex: 'importance',
      key: 'importance',
      width: 100,
      render: (importance) => <ImportanceTag importance={importance} />,
    },
    {
      title: t('clue.stage'),
      dataIndex: 'stage',
      key: 'stage',
      width: 80,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => <StatusTag status={status} />,
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!npc) {
    return <Empty description={t('npc.notFound')} />;
  }

  return (
    <div>
      <PageHeader
        title={npc.name}
        subtitle={`${npc.job || t('npc.noJob')} - ${t(`npc.${npc.role_type}`)}`}
        breadcrumbs={[
          { title: t('npc.title'), path: '/npcs' },
          { title: npc.name },
        ]}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => form.submit()}
          >
            {t('common.save')}
          </Button>
        }
      />

      <Tabs
        defaultActiveKey="basic"
        items={[
          {
            key: 'basic',
            label: t('common.basicInfo'),
            children: (
              <Card>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Row gutter={24}>
                    <Col span={12}>
                      <Form.Item
                        name="name"
                        label={t('common.name')}
                        rules={[{ required: true, message: t('npc.enterNpcName') }]}
                      >
                        <Input placeholder={t('npc.enterNpcName')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="name_en" label={t('npc.englishName')}>
                        <Input placeholder={t('npc.enterEnglishName')} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="age" label={t('npc.age')}>
                        <Input type="number" placeholder={t('npc.enterAge')} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="job" label={t('npc.job')}>
                        <Input placeholder={t('npc.enterJob')} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="role_type"
                        label={t('npc.roleType')}
                        rules={[{ required: true }]}
                      >
                        <Select>
                          <Option value="suspect">{t('npc.suspect')}</Option>
                          <Option value="witness">{t('npc.witness')}</Option>
                          <Option value="other">{t('npc.other')}</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="script_id"
                        label={t('script.title')}
                        rules={[{ required: true }]}
                      >
                        <Select
                          onChange={(value) => {
                            setSelectedScriptId(value);
                            form.setFieldValue('scene_id', null);
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
                    <Col span={12}>
                      <Form.Item name="scene_id" label={t('common.scene')}>
                        <Select allowClear placeholder={`${t('npc.selectScene')} (${t('common.optional')})`}>
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
                          <Option value="active">{t('npc.active')}</Option>
                          <Option value="archived">{t('npc.archived')}</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Card>
            ),
          },
          {
            key: 'personality',
            label: t('common.character'),
            children: (
              <Card>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Form.Item name="personality" label={t('npc.personality')}>
                    <TextArea
                      placeholder={t('npc.personalityPlaceholder')}
                      rows={4}
                    />
                  </Form.Item>
                  <Form.Item name="speech_style" label={t('npc.speechStyle')}>
                    <TextArea
                      placeholder={t('npc.speechStylePlaceholder')}
                      rows={4}
                    />
                  </Form.Item>
                  <Form.Item
                    name="background_story"
                    label={t('npc.backgroundStory')}
                    extra={<Text type="secondary">{t('npc.supportsMarkdown')}</Text>}
                  >
                    <TextArea
                      placeholder={t('npc.backgroundPlaceholder')}
                      rows={10}
                    />
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'knowledge',
            label: t('npc.knowledgeScope'),
            children: (
              <Card>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Form.Item
                    name={['knowledge_scope', 'knows']}
                    label={t('npc.knows')}
                  >
                    <Select
                      mode="tags"
                      placeholder={t('npc.knowsPlaceholder')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item
                    name={['knowledge_scope', 'does_not_know']}
                    label={t('npc.doesNotKnow')}
                  >
                    <Select
                      mode="tags"
                      placeholder={t('npc.doesNotKnowPlaceholder')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item
                    name={['knowledge_scope', 'world_model_limits']}
                    label={t('npc.worldModelLimits')}
                  >
                    <Select
                      mode="tags"
                      placeholder={t('npc.worldModelLimitsPlaceholder')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'prompt',
            label: t('common.systemPrompt'),
            children: (
              <Card>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Form.Item
                    name="system_prompt_template"
                    label={t('npc.systemPromptTemplate')}
                    extra={
                      <Text type="secondary">
                        {t('npc.availableVariables')}: {'{name}'}, {'{personality}'}, {'{speech_style}'},{' '}
                        {'{background_story}'}, {'{current_scene}'}, {'{unlocked_clues}'}
                      </Text>
                    }
                  >
                    <TextArea
                      placeholder={`You are {name}, a {job} in a murder mystery game.

Personality: {personality}

Speaking Style: {speech_style}

Background: {background_story}

Current Scene: {current_scene}

You know about these clues: {unlocked_clues}

Stay in character and respond naturally to the player's questions.`}
                      rows={15}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'clues',
            label: `${t('npc.relatedClues')} (${relatedClues.length})`,
            children: (
              <Card>
                <ResizableTable
                  columns={clueColumns}
                  dataSource={relatedClues}
                  rowKey="id"
                  pagination={false}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
