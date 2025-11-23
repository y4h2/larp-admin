import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Tabs,
  Table,
  Spin,
  Empty,
  Row,
  Col,
  message,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { PageHeader, StatusTag, ClueTypeTag, ImportanceTag } from '@/components/common';
import { npcApi, clueApi } from '@/api';
import { useScripts, useScenes } from '@/hooks';
import type { NPC, Clue } from '@/types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

export default function NpcDetail() {
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
      message.error('Failed to load NPC');
      navigate('/npcs');
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate]);

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
      message.success('NPC saved successfully');
    } catch {
      message.error('Failed to save NPC');
    } finally {
      setSaving(false);
    }
  };

  const clueColumns: TableProps<Clue>['columns'] = [
    {
      title: 'Title',
      dataIndex: 'title_internal',
      key: 'title_internal',
      render: (text, record) => (
        <a onClick={() => navigate(`/clues/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'clue_type',
      key: 'clue_type',
      width: 100,
      render: (type) => <ClueTypeTag type={type} />,
    },
    {
      title: 'Importance',
      dataIndex: 'importance',
      key: 'importance',
      width: 100,
      render: (importance) => <ImportanceTag importance={importance} />,
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      width: 80,
    },
    {
      title: 'Status',
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
    return <Empty description="NPC not found" />;
  }

  return (
    <div>
      <PageHeader
        title={npc.name}
        subtitle={`${npc.job || 'No job'} - ${npc.role_type}`}
        breadcrumbs={[
          { title: 'NPCs', path: '/npcs' },
          { title: npc.name },
        ]}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => form.submit()}
          >
            Save
          </Button>
        }
      />

      <Tabs
        defaultActiveKey="basic"
        items={[
          {
            key: 'basic',
            label: 'Basic Info',
            children: (
              <Card>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Row gutter={24}>
                    <Col span={12}>
                      <Form.Item
                        name="name"
                        label="Name"
                        rules={[{ required: true, message: 'Please enter NPC name' }]}
                      >
                        <Input placeholder="Enter NPC name" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="name_en" label="English Name">
                        <Input placeholder="Enter English name" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="age" label="Age">
                        <Input type="number" placeholder="Enter age" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="job" label="Job">
                        <Input placeholder="Enter job title" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="role_type"
                        label="Role Type"
                        rules={[{ required: true }]}
                      >
                        <Select>
                          <Option value="suspect">Suspect</Option>
                          <Option value="witness">Witness</Option>
                          <Option value="other">Other</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="script_id"
                        label="Script"
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
                      <Form.Item name="scene_id" label="Scene">
                        <Select allowClear placeholder="Select scene (optional)">
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
                          <Option value="active">Active</Option>
                          <Option value="archived">Archived</Option>
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
            label: 'Character',
            children: (
              <Card>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Form.Item name="personality" label="Personality">
                    <TextArea
                      placeholder="Describe the NPC's personality traits, behaviors, and quirks"
                      rows={4}
                    />
                  </Form.Item>
                  <Form.Item name="speech_style" label="Speech Style">
                    <TextArea
                      placeholder="Describe how the NPC speaks - formal, casual, specific phrases, accent, etc."
                      rows={4}
                    />
                  </Form.Item>
                  <Form.Item
                    name="background_story"
                    label="Background Story"
                    extra={<Text type="secondary">Supports Markdown formatting</Text>}
                  >
                    <TextArea
                      placeholder="Write the NPC's background story, history, motivations, and secrets"
                      rows={10}
                    />
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'prompt',
            label: 'System Prompt',
            children: (
              <Card>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Form.Item
                    name="system_prompt_template"
                    label="System Prompt Template"
                    extra={
                      <Text type="secondary">
                        Available variables: {'{name}'}, {'{personality}'}, {'{speech_style}'},{' '}
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
            label: `Related Clues (${relatedClues.length})`,
            children: (
              <Card>
                <Table
                  columns={clueColumns}
                  dataSource={relatedClues}
                  rowKey="id"
                  pagination={false}
                  locale={{ emptyText: 'No clues associated with this NPC' }}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
