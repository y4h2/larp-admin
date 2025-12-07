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
  Space,
  message,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, ResizableTable, VariableLabel, type ResizableColumn } from '@/components/common';
import { NPC_VARIABLES } from '@/constants';
import { npcApi, clueApi } from '@/api';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { NPC, Clue } from '@/types';

const { Option } = Select;
const { TextArea } = Input;

export default function NpcDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const { scripts, fetchReferenceData } = useReferenceData();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [npc, setNpc] = useState<NPC | null>(null);
  const [relatedClues, setRelatedClues] = useState<Clue[]>([]);

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
      const formData = {
        ...npcData,
        knowledge_scope: {
          knows: npcData.knowledge_scope?.knows || [],
          does_not_know: npcData.knowledge_scope?.does_not_know || [],
          world_model_limits: npcData.knowledge_scope?.world_model_limits || [],
        },
      };
      form.setFieldsValue(formData);
    } catch {
      message.error(t('common.loadFailed'));
      navigate('/npcs');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, t, form]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

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
      title: t('clue.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/clues/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: t('clue.type'),
      dataIndex: 'type',
      key: 'type',
      width: 100,
    },
    {
      title: t('clue.detail'),
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
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

  const scriptTitle = scripts.find(s => s.id === npc.script_id)?.title || '';

  return (
    <div>
      <PageHeader
        title={npc.name}
        subtitle={scriptTitle}
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
                        name="name"
                        label={<VariableLabel label={t('common.name')} variablePath={NPC_VARIABLES.name} />}
                        rules={[{ required: true, message: t('npc.enterNpcName') }]}
                      >
                        <Input placeholder={t('npc.enterNpcName')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="age" label={<VariableLabel label={t('npc.age')} variablePath={NPC_VARIABLES.age} />}>
                        <Input type="number" placeholder={t('npc.enterAge')} />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        name="script_id"
                        label={t('script.title')}
                        rules={[{ required: true }]}
                      >
                        <Select placeholder={t('script.selectScript')}>
                          {scripts.map((s) => (
                            <Option key={s.id} value={s.id}>
                              {s.title}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="background" label={<VariableLabel label={t('npc.background')} variablePath={NPC_VARIABLES.background} />}>
                        <TextArea
                          placeholder={t('npc.enterBackground')}
                          rows={4}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="personality" label={<VariableLabel label={t('npc.personality')} variablePath={NPC_VARIABLES.personality} />}>
                        <TextArea
                          placeholder={t('npc.enterPersonality')}
                          rows={4}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ),
            },
            {
              key: 'knowledge',
              label: t('npc.knowledgeScope'),
              children: (
                <Card>
                  <Form.Item
                    name={['knowledge_scope', 'knows']}
                    label={<VariableLabel label={t('npc.knows')} variablePath={NPC_VARIABLES['knowledge_scope.knows']} />}
                  >
                    <Select
                      mode="tags"
                      placeholder={t('npc.knowsPlaceholder')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item
                    name={['knowledge_scope', 'does_not_know']}
                    label={<VariableLabel label={t('npc.doesNotKnow')} variablePath={NPC_VARIABLES['knowledge_scope.does_not_know']} />}
                  >
                    <Select
                      mode="tags"
                      placeholder={t('npc.doesNotKnowPlaceholder')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item
                    name={['knowledge_scope', 'world_model_limits']}
                    label={<VariableLabel label={t('npc.worldModelLimits')} variablePath={NPC_VARIABLES['knowledge_scope.world_model_limits']} />}
                  >
                    <Select
                      mode="tags"
                      placeholder={t('npc.worldModelLimitsPlaceholder')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
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
      </Form>
    </div>
  );
}
