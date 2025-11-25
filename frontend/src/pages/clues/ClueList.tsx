import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Tag,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';
import { useClues, useScripts, useNpcs } from '@/hooks';
import { formatDate } from '@/utils';
import type { Clue } from '@/types';

const { Option } = Select;

export default function ClueList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const { loading, clues, total, fetchClues, createClue, deleteClue } = useClues();
  const { scripts, fetchScripts } = useScripts();
  const { npcs, fetchNpcs } = useNpcs();

  const [modalVisible, setModalVisible] = useState(false);
  const [filters, setFilters] = useState<{
    script_id?: string;
    npc_id?: string;
    type?: Clue['type'];
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
    if (filters.script_id) {
      fetchNpcs({ script_id: filters.script_id });
    }
  }, [filters.script_id, fetchNpcs]);

  useEffect(() => {
    fetchClues(filters);
  }, [filters, fetchClues]);

  const handleCreate = async (values: Partial<Clue>) => {
    try {
      const clue = await createClue(values);
      setModalVisible(false);
      form.resetFields();
      navigate(`/clues/${clue.id}`);
    } catch {
      // Error handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClue(id);
      fetchClues(filters);
    } catch {
      // Error handled in hook
    }
  };

  const columns: ResizableColumn<Clue>[] = [
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
      render: (type) => (
        <Tag color={type === 'text' ? 'blue' : 'green'}>{type}</Tag>
      ),
    },
    {
      title: 'NPC',
      dataIndex: 'npc_id',
      key: 'npc_id',
      width: 150,
      render: (npcId: string) => {
        const npc = npcs.find((n) => n.id === npcId);
        return <Tag>{npc?.name || npcId}</Tag>;
      },
    },
    {
      title: t('clue.triggerKeywords'),
      dataIndex: 'trigger_keywords',
      key: 'trigger_keywords',
      width: 200,
      render: (keywords: string[]) => (
        <Space size={[0, 4]} wrap>
          {keywords.slice(0, 3).map((kw, i) => (
            <Tag key={i} style={{ margin: 0 }}>{kw}</Tag>
          ))}
          {keywords.length > 3 && <Tag>+{keywords.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: t('clue.prerequisites'),
      dataIndex: 'prereq_clue_ids',
      key: 'prereq_clue_ids',
      width: 150,
      render: (prereqIds: string[]) => {
        if (!prereqIds || prereqIds.length === 0) {
          return <Tag color="green">{t('clue.noneRoot')}</Tag>;
        }
        return (
          <Space size={[0, 4]} wrap>
            {prereqIds.slice(0, 2).map((prereqId) => {
              const prereq = clues.find((c) => c.id === prereqId);
              return (
                <Tag key={prereqId} style={{ margin: 0 }} color="blue">
                  {prereq?.name || prereqId.slice(0, 8)}
                </Tag>
              );
            })}
            {prereqIds.length > 2 && <Tag>+{prereqIds.length - 2}</Tag>}
          </Space>
        );
      },
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/clues/${record.id}`)}
          />
          <Popconfirm
            title={t('clue.deleteClue')}
            description={t('clue.deleteConfirm')}
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
        title={t('clue.title')}
        subtitle={t('clue.subtitle')}
        extra={
          <Space>
            <Button
              icon={<NodeIndexOutlined />}
              onClick={() => navigate(`/clues/tree${filters.script_id ? `?script_id=${filters.script_id}` : ''}`)}
            >
              {t('common.viewTree')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              {t('clue.createClue')}
            </Button>
          </Space>
        }
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder={t('clue.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder={t('clue.selectScript')}
          value={filters.script_id}
          onChange={(value) =>
            setFilters({ ...filters, script_id: value, npc_id: undefined, page: 1 })
          }
          style={{ width: 160 }}
          allowClear
        >
          {scripts.map((s) => (
            <Option key={s.id} value={s.id}>
              {s.title}
            </Option>
          ))}
        </Select>
        <Select
          placeholder={t('clue.selectNpc')}
          value={filters.npc_id}
          onChange={(value) => setFilters({ ...filters, npc_id: value, page: 1 })}
          style={{ width: 140 }}
          allowClear
          disabled={!filters.script_id}
        >
          {npcs.map((n) => (
            <Option key={n.id} value={n.id}>
              {n.name}
            </Option>
          ))}
        </Select>
        <Select
          placeholder={t('clue.type')}
          value={filters.type}
          onChange={(value) => setFilters({ ...filters, type: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="text">{t('common.text')}</Option>
          <Option value="image">{t('common.image')}</Option>
        </Select>
      </Space>

      <ResizableTable
        columns={columns}
        dataSource={clues}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          showTotal: (total: number) => t('clue.totalClues', { total }),
          onChange: (page: number, pageSize: number) =>
            setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title={t('clue.createClue')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="script_id"
            label={t('script.title')}
            rules={[{ required: true, message: t('clue.pleaseSelectScript') }]}
            initialValue={filters.script_id}
          >
            <Select
              placeholder={t('clue.selectScript')}
              onChange={(value) => {
                if (value) {
                  fetchNpcs({ script_id: value });
                }
              }}
            >
              {scripts.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.title}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="npc_id"
            label="NPC"
            rules={[{ required: true, message: t('clue.selectNpc') }]}
          >
            <Select placeholder={t('clue.selectNpc')}>
              {npcs.map((n) => (
                <Option key={n.id} value={n.id}>
                  {n.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label={t('clue.name')}
            rules={[{ required: true }]}
          >
            <Input placeholder={t('clue.name')} />
          </Form.Item>
          <Form.Item name="type" label={t('clue.type')} initialValue="text">
            <Select>
              <Option value="text">{t('common.text')}</Option>
              <Option value="image">{t('common.image')}</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="detail"
            label={t('clue.detail')}
            rules={[{ required: true }]}
          >
            <Input.TextArea placeholder={t('clue.detailPlaceholder')} rows={3} />
          </Form.Item>
          <Form.Item
            name="detail_for_npc"
            label={t('clue.detailForNpc')}
            rules={[{ required: true }]}
          >
            <Input.TextArea placeholder={t('clue.detailForNpcPlaceholder')} rows={3} />
          </Form.Item>
          <Form.Item name="trigger_keywords" label={t('clue.triggerKeywords')}>
            <Select mode="tags" placeholder={t('clue.triggerKeywordsPlaceholder')} />
          </Form.Item>
          <Form.Item name="trigger_semantic_summary" label={t('clue.triggerSemanticSummary')}>
            <Input.TextArea placeholder={t('clue.triggerSemanticSummaryPlaceholder')} rows={2} />
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
