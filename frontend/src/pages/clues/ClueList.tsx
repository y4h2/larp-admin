import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Tag,
  Popconfirm,
} from 'antd';
import type { TableProps } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { PageHeader, StatusTag, ClueTypeTag, ImportanceTag } from '@/components/common';
import { useClues, useScripts, useScenes, useNpcs } from '@/hooks';
import { formatDate } from '@/utils';
import type { Clue } from '@/types';

const { Option } = Select;

export default function ClueList() {
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

  const columns: TableProps<Clue>['columns'] = [
    {
      title: 'Internal Title',
      dataIndex: 'title_internal',
      key: 'title_internal',
      render: (text, record) => (
        <a onClick={() => navigate(`/clues/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Player Title',
      dataIndex: 'title_player',
      key: 'title_player',
      ellipsis: true,
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 70,
      render: (v) => `v${v}`,
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: 'Actions',
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
            title="Delete Clue"
            description="Are you sure you want to delete this clue?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
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
        title="Clue Management"
        subtitle="Manage game clues and their unlock conditions"
        extra={
          <Space>
            <Button
              icon={<NodeIndexOutlined />}
              onClick={() => navigate(`/clues/tree${filters.script_id ? `?script_id=${filters.script_id}` : ''}`)}
            >
              View Tree
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              Create Clue
            </Button>
          </Space>
        }
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Search clues..."
          prefix={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="Select Script"
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
          placeholder="Select Scene"
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
          placeholder="Select NPC"
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
          placeholder="Type"
          value={filters.clue_type}
          onChange={(value) => setFilters({ ...filters, clue_type: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="evidence">Evidence</Option>
          <Option value="testimony">Testimony</Option>
          <Option value="world_info">World Info</Option>
          <Option value="decoy">Decoy</Option>
        </Select>
        <Select
          placeholder="Importance"
          value={filters.importance}
          onChange={(value) => setFilters({ ...filters, importance: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="critical">Critical</Option>
          <Option value="major">Major</Option>
          <Option value="minor">Minor</Option>
          <Option value="easter_egg">Easter Egg</Option>
        </Select>
        <Input
          placeholder="Stage"
          type="number"
          value={filters.stage}
          onChange={(e) =>
            setFilters({ ...filters, stage: e.target.value ? Number(e.target.value) : undefined, page: 1 })
          }
          style={{ width: 80 }}
        />
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
          style={{ width: 100 }}
          allowClear
        >
          <Option value="draft">Draft</Option>
          <Option value="active">Active</Option>
          <Option value="disabled">Disabled</Option>
        </Select>
      </Space>

      <Table
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
          showTotal: (total) => `Total ${total} clues`,
          onChange: (page, pageSize) =>
            setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title="Create Clue"
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
            label="Script"
            rules={[{ required: true, message: 'Please select a script' }]}
            initialValue={filters.script_id}
          >
            <Select
              placeholder="Select script"
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
          <Form.Item name="scene_id" label="Scene">
            <Select placeholder="Select scene (optional)" allowClear>
              {scenes.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="title_internal"
            label="Internal Title"
            rules={[{ required: true, message: 'Please enter internal title' }]}
          >
            <Input placeholder="For internal reference" />
          </Form.Item>
          <Form.Item
            name="title_player"
            label="Player Title"
            rules={[{ required: true, message: 'Please enter player title' }]}
          >
            <Input placeholder="Title shown to players" />
          </Form.Item>
          <Form.Item
            name="content_text"
            label="Content"
            rules={[{ required: true, message: 'Please enter content' }]}
          >
            <Input.TextArea placeholder="Clue content text" rows={3} />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item
              name="clue_type"
              label="Type"
              rules={[{ required: true }]}
              style={{ width: 180 }}
            >
              <Select placeholder="Select type">
                <Option value="evidence">Evidence</Option>
                <Option value="testimony">Testimony</Option>
                <Option value="world_info">World Info</Option>
                <Option value="decoy">Decoy</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="importance"
              label="Importance"
              rules={[{ required: true }]}
              style={{ width: 180 }}
            >
              <Select placeholder="Select importance">
                <Option value="critical">Critical</Option>
                <Option value="major">Major</Option>
                <Option value="minor">Minor</Option>
                <Option value="easter_egg">Easter Egg</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="stage"
              label="Stage"
              initialValue={1}
              style={{ width: 100 }}
            >
              <Input type="number" min={1} />
            </Form.Item>
          </Space>
          <Form.Item
            name="npc_ids"
            label="Associated NPCs"
          >
            <Select mode="multiple" placeholder="Select NPCs">
              {npcs.map((n) => (
                <Option key={n.id} value={n.id}>
                  {n.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="content_type" label="Content Type" initialValue="text">
            <Select>
              <Option value="text">Text</Option>
              <Option value="image">Image</Option>
              <Option value="structured">Structured</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create
              </Button>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
