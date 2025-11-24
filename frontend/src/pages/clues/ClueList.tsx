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
import { PageHeader, StatusTag, ClueTypeTag, ImportanceTag, ResizableTable, type ResizableColumn } from '@/components/common';
import { useClues, useScripts, useScenes, useNpcs } from '@/hooks';
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
  const { scenes, fetchScenes } = useScenes();
  const { npcs, fetchNpcs } = useNpcs();

  const [modalVisible, setModalVisible] = useState(false);
  const [filters, setFilters] = useState<{
    script_id?: string;
    scene_id?: string;
    npc_id?: string;
    stage?: number;
    clue_type?: Clue['clue_type'];
    importance?: Clue['importance'];
    status?: Clue['status'];
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
      fetchScenes({ script_id: filters.script_id });
      fetchNpcs({ script_id: filters.script_id });
    }
  }, [filters.script_id, fetchScenes, fetchNpcs]);

  useEffect(() => {
    fetchClues(filters);
  }, [filters, fetchClues]);

  const handleCreate = async (values: Partial<Clue>) => {
    try {
      const clue = await createClue({
        ...values,
        content_payload: {},
        unlock_conditions: {
          text_conditions: { keyword_lists: [], blacklist: [] },
          semantic_conditions: null,
          state_conditions: null,
        },
        effects: {
          display_text: '',
          game_state_updates: {},
          one_time_trigger: false,
        },
      });
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
      title: t('clue.internalTitle'),
      dataIndex: 'title_internal',
      key: 'title_internal',
      render: (text, record) => (
        <a onClick={() => navigate(`/clues/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: t('clue.playerTitle'),
      dataIndex: 'title_player',
      key: 'title_player',
      ellipsis: true,
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
      width: 70,
    },
    {
      title: 'NPCs',
      dataIndex: 'npc_ids',
      key: 'npc_ids',
      width: 150,
      render: (npcIds: string[]) => (
        <Space size={[0, 4]} wrap>
          {npcIds.slice(0, 2).map((npcId) => {
            const npc = npcs.find((n) => n.id === npcId);
            return (
              <Tag key={npcId} style={{ margin: 0 }}>
                {npc?.name || npcId}
              </Tag>
            );
          })}
          {npcIds.length > 2 && <Tag>+{npcIds.length - 2}</Tag>}
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
                  {prereq?.title_internal || prereqId.slice(0, 8)}
                </Tag>
              );
            })}
            {prereqIds.length > 2 && <Tag>+{prereqIds.length - 2}</Tag>}
          </Space>
        );
      },
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: t('common.version'),
      dataIndex: 'version',
      key: 'version',
      width: 70,
      render: (v) => `v${v}`,
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
            setFilters({ ...filters, script_id: value, scene_id: undefined, npc_id: undefined, page: 1 })
          }
          style={{ width: 160 }}
          allowClear
        >
          {scripts.map((s) => (
            <Option key={s.id} value={s.id}>
              {s.name}
            </Option>
          ))}
        </Select>
        <Select
          placeholder={t('clue.selectScene')}
          value={filters.scene_id}
          onChange={(value) => setFilters({ ...filters, scene_id: value, page: 1 })}
          style={{ width: 160 }}
          allowClear
          disabled={!filters.script_id}
        >
          {scenes.map((s) => (
            <Option key={s.id} value={s.id}>
              {s.name}
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
          value={filters.clue_type}
          onChange={(value) => setFilters({ ...filters, clue_type: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="evidence">{t('clue.evidence')}</Option>
          <Option value="testimony">{t('clue.testimony')}</Option>
          <Option value="world_info">{t('clue.worldInfo')}</Option>
          <Option value="decoy">{t('clue.decoy')}</Option>
        </Select>
        <Select
          placeholder={t('clue.importance')}
          value={filters.importance}
          onChange={(value) => setFilters({ ...filters, importance: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="critical">{t('clue.critical')}</Option>
          <Option value="major">{t('clue.major')}</Option>
          <Option value="minor">{t('clue.minor')}</Option>
          <Option value="easter_egg">{t('clue.easterEgg')}</Option>
        </Select>
        <Input
          placeholder={t('clue.stage')}
          type="number"
          value={filters.stage}
          onChange={(e) =>
            setFilters({ ...filters, stage: e.target.value ? Number(e.target.value) : undefined, page: 1 })
          }
          style={{ width: 80 }}
        />
        <Select
          placeholder={t('common.status')}
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
          style={{ width: 100 }}
          allowClear
        >
          <Option value="draft">{t('clue.draft')}</Option>
          <Option value="active">{t('clue.active')}</Option>
          <Option value="disabled">{t('clue.disabled')}</Option>
        </Select>
      </Space>

      <ResizableTable
        columns={columns}
        dataSource={clues}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
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
                  fetchScenes({ script_id: value });
                  fetchNpcs({ script_id: value });
                }
              }}
            >
              {scripts.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="scene_id" label={t('common.scene')}>
            <Select placeholder={`${t('clue.selectScene')} (${t('common.optional')})`} allowClear>
              {scenes.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="title_internal"
            label={t('clue.internalTitle')}
            rules={[{ required: true, message: t('clue.pleaseEnterInternalTitle') }]}
          >
            <Input placeholder={t('clue.internalTitlePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="title_player"
            label={t('clue.playerTitle')}
            rules={[{ required: true, message: t('clue.pleaseEnterPlayerTitle') }]}
          >
            <Input placeholder={t('clue.playerTitlePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="content_text"
            label={t('clue.content')}
            rules={[{ required: true, message: t('clue.pleaseEnterContent') }]}
          >
            <Input.TextArea placeholder={t('clue.contentPlaceholder')} rows={3} />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item
              name="clue_type"
              label={t('clue.type')}
              rules={[{ required: true }]}
              style={{ width: 180 }}
            >
              <Select placeholder={t('clue.type')}>
                <Option value="evidence">{t('clue.evidence')}</Option>
                <Option value="testimony">{t('clue.testimony')}</Option>
                <Option value="world_info">{t('clue.worldInfo')}</Option>
                <Option value="decoy">{t('clue.decoy')}</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="importance"
              label={t('clue.importance')}
              rules={[{ required: true }]}
              style={{ width: 180 }}
            >
              <Select placeholder={t('clue.importance')}>
                <Option value="critical">{t('clue.critical')}</Option>
                <Option value="major">{t('clue.major')}</Option>
                <Option value="minor">{t('clue.minor')}</Option>
                <Option value="easter_egg">{t('clue.easterEgg')}</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="stage"
              label={t('clue.stage')}
              initialValue={1}
              style={{ width: 100 }}
            >
              <Input type="number" min={1} />
            </Form.Item>
          </Space>
          <Form.Item
            name="npc_ids"
            label={t('clue.associatedNpcs')}
          >
            <Select mode="multiple" placeholder={t('clue.selectNpc')}>
              {npcs.map((n) => (
                <Option key={n.id} value={n.id}>
                  {n.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="content_type" label={t('clue.contentType')} initialValue="text">
            <Select>
              <Option value="text">{t('common.text')}</Option>
              <Option value="image">{t('common.image')}</Option>
              <Option value="structured">{t('common.structured')}</Option>
            </Select>
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
