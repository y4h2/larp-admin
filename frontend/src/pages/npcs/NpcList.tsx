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
  Popconfirm,
} from 'antd';
import type { TableProps } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { PageHeader, StatusTag, RoleTypeTag } from '@/components/common';
import { useNpcs, useScripts, useScenes } from '@/hooks';
import { formatDate } from '@/utils';
import type { NPC } from '@/types';

const { Option } = Select;

export default function NpcList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const { loading, npcs, total, fetchNpcs, createNpc, deleteNpc } = useNpcs();
  const { scripts, fetchScripts } = useScripts();
  const { scenes, fetchScenes } = useScenes();

  const [modalVisible, setModalVisible] = useState(false);
  const [filters, setFilters] = useState<{
    script_id?: string;
    scene_id?: string;
    role_type?: NPC['role_type'];
    status?: NPC['status'];
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
    }
  }, [filters.script_id, fetchScenes]);

  useEffect(() => {
    fetchNpcs(filters);
  }, [filters, fetchNpcs]);

  const handleCreate = async (values: Partial<NPC>) => {
    try {
      const npc = await createNpc({
        ...values,
        personality: '',
        speech_style: '',
        background_story: '',
        relations: {},
        system_prompt_template: '',
        extra_prompt_vars: {},
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

  const columns: TableProps<NPC>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/npcs/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role_type',
      key: 'role_type',
      width: 100,
      render: (roleType) => <RoleTypeTag roleType={roleType} />,
    },
    {
      title: 'Job',
      dataIndex: 'job',
      key: 'job',
      width: 120,
      render: (job) => job || '-',
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      width: 60,
      render: (age) => age || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (date) => formatDate(date),
    },
    {
      title: 'Actions',
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
            title="Delete NPC"
            description="Are you sure you want to delete this NPC?"
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
        title="NPC Management"
        subtitle="Manage game NPCs and their configurations"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            Create NPC
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Search NPCs..."
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
            setFilters({ ...filters, script_id: value, scene_id: undefined, page: 1 })
          }
          style={{ width: 180 }}
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
          style={{ width: 180 }}
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
          placeholder="Role Type"
          value={filters.role_type}
          onChange={(value) => setFilters({ ...filters, role_type: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="suspect">Suspect</Option>
          <Option value="witness">Witness</Option>
          <Option value="other">Other</Option>
        </Select>
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="active">Active</Option>
          <Option value="archived">Archived</Option>
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={npcs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} NPCs`,
          onChange: (page, pageSize) =>
            setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title="Create NPC"
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
            label="Script"
            rules={[{ required: true, message: 'Please select a script' }]}
            initialValue={filters.script_id}
          >
            <Select placeholder="Select script">
              {scripts.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label="NPC Name"
            rules={[{ required: true, message: 'Please enter NPC name' }]}
          >
            <Input placeholder="Enter NPC name" />
          </Form.Item>
          <Form.Item name="name_en" label="English Name">
            <Input placeholder="Enter English name (optional)" />
          </Form.Item>
          <Form.Item
            name="role_type"
            label="Role Type"
            rules={[{ required: true, message: 'Please select role type' }]}
          >
            <Select placeholder="Select role type">
              <Option value="suspect">Suspect</Option>
              <Option value="witness">Witness</Option>
              <Option value="other">Other</Option>
            </Select>
          </Form.Item>
          <Form.Item name="age" label="Age">
            <Input type="number" placeholder="Enter age" />
          </Form.Item>
          <Form.Item name="job" label="Job">
            <Input placeholder="Enter job title" />
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
