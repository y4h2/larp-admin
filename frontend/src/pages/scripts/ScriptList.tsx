import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Dropdown,
} from 'antd';
import type { MenuProps, TableProps } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  InboxOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { PageHeader, StatusTag } from '@/components/common';
import { useScripts } from '@/hooks';
import { formatDate } from '@/utils';
import type { Script } from '@/types';

const { Option } = Select;

export default function ScriptList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const {
    loading,
    scripts,
    total,
    fetchScripts,
    createScript,
    deleteScript,
    copyScript,
    archiveScript,
  } = useScripts();

  const [modalVisible, setModalVisible] = useState(false);
  const [filters, setFilters] = useState<{
    status?: Script['status'];
    search?: string;
    page: number;
    page_size: number;
  }>({
    page: 1,
    page_size: 10,
  });

  useEffect(() => {
    fetchScripts(filters);
  }, [filters, fetchScripts]);

  const handleCreate = async (values: Partial<Script>) => {
    try {
      const script = await createScript(values);
      setModalVisible(false);
      form.resetFields();
      fetchScripts(filters);
      navigate(`/scripts/${script.id}`);
    } catch {
      // Error already handled in hook
    }
  };

  const handleCopy = async (id: string) => {
    try {
      await copyScript(id);
      fetchScripts(filters);
    } catch {
      // Error already handled
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteScript(id);
      fetchScripts(filters);
    } catch {
      // Error already handled
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveScript(id);
      fetchScripts(filters);
    } catch {
      // Error already handled
    }
  };

  const getActionMenu = (record: Script): MenuProps['items'] => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit',
      onClick: () => navigate(`/scripts/${record.id}`),
    },
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: 'Copy',
      onClick: () => handleCopy(record.id),
    },
    {
      key: 'archive',
      icon: <InboxOutlined />,
      label: 'Archive',
      onClick: () => handleArchive(record.id),
      disabled: record.status === 'archived',
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete',
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: 'Delete Script',
          content: `Are you sure you want to delete "${record.name}"? This action cannot be undone.`,
          okText: 'Delete',
          okType: 'danger',
          onOk: () => handleDelete(record.id),
        });
      },
    },
  ];

  const columns: TableProps<Script>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/scripts/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (version) => `v${version}`,
    },
    {
      title: 'Creator',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 120,
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
      width: 80,
      render: (_, record) => (
        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Script Management"
        subtitle="Manage game scripts and their scenes"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            Create Script
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search scripts..."
          prefix={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 250 }}
          allowClear
        />
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="draft">Draft</Option>
          <Option value="test">Testing</Option>
          <Option value="online">Online</Option>
          <Option value="archived">Archived</Option>
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={scripts}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} scripts`,
          onChange: (page, pageSize) =>
            setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title="Create Script"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="name"
            label="Script Name"
            rules={[{ required: true, message: 'Please enter script name' }]}
          >
            <Input placeholder="Enter script name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Enter description" rows={3} />
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
