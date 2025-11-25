import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';
import { useNpcs, useScripts } from '@/hooks';
import { formatDate } from '@/utils';
import type { NPC } from '@/types';

const { Option } = Select;

export default function NpcList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const { loading, npcs, total, fetchNpcs, createNpc, deleteNpc } = useNpcs();
  const { scripts, fetchScripts } = useScripts();

  const [modalVisible, setModalVisible] = useState(false);
  const [filters, setFilters] = useState<{
    script_id?: string;
    search?: string;
    page: number;
    page_size: number;
  }>({
    script_id: searchParams.get('script_id') || undefined,
    page: 1,
    page_size: 10,
  });

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    fetchNpcs(filters);
  }, [filters, fetchNpcs]);

  const handleCreate = async (values: Partial<NPC>) => {
    try {
      const npc = await createNpc({
        ...values,
        knowledge_scope: { knows: [], does_not_know: [], world_model_limits: [] },
      });
      setModalVisible(false);
      form.resetFields();
      navigate(`/npcs/${npc.id}`);
    } catch {
      // Error handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNpc(id);
      fetchNpcs(filters);
    } catch {
      // Error handled in hook
    }
  };

  const columns: ResizableColumn<NPC>[] = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/npcs/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: t('npc.age'),
      dataIndex: 'age',
      key: 'age',
      width: 80,
      render: (age) => age || '-',
    },
    {
      title: t('npc.personality'),
      dataIndex: 'personality',
      key: 'personality',
      width: 200,
      ellipsis: true,
      render: (personality) => personality || '-',
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (date) => formatDate(date),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/npcs/${record.id}`)}
          />
          <Popconfirm
            title={t('npc.deleteNpc')}
            description={t('npc.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.delete')}
            okType="danger"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('npc.title')}
        subtitle={t('npc.subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            {t('npc.createNpc')}
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder={t('npc.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder={t('npc.selectScript')}
          value={filters.script_id}
          onChange={(value) =>
            setFilters({ ...filters, script_id: value, page: 1 })
          }
          style={{ width: 180 }}
          allowClear
        >
          {scripts.map((s) => (
            <Option key={s.id} value={s.id}>
              {s.title}
            </Option>
          ))}
        </Select>
      </Space>

      <ResizableTable
        columns={columns}
        dataSource={npcs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          showTotal: (total: number) => t('npc.totalNpcs', { total }),
          onChange: (page: number, pageSize: number) =>
            setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title={t('npc.createNpc')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="script_id"
            label={t('script.title')}
            rules={[{ required: true, message: t('npc.pleaseSelectScript') }]}
            initialValue={filters.script_id}
          >
            <Select placeholder={t('npc.selectScript')}>
              {scripts.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.title}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label={t('npc.npcName')}
            rules={[{ required: true, message: t('npc.enterNpcName') }]}
          >
            <Input placeholder={t('npc.enterNpcName')} />
          </Form.Item>
          <Form.Item name="age" label={t('npc.age')}>
            <Input type="number" placeholder={t('npc.enterAge')} />
          </Form.Item>
          <Form.Item name="personality" label={t('npc.personality')}>
            <Input.TextArea placeholder={t('npc.enterPersonality')} rows={2} />
          </Form.Item>
          <Form.Item name="background" label={t('npc.background')}>
            <Input.TextArea placeholder={t('npc.enterBackground')} rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('common.create')}
              </Button>
              <Button onClick={() => setModalVisible(false)}>{t('common.cancel')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
