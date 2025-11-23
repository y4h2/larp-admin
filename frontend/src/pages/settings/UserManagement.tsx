import { useEffect, useState } from 'react';
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
  message,
} from 'antd';
import type { TableProps } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { PageHeader, StatusTag } from '@/components/common';
import { userApi } from '@/api';
import { formatDate } from '@/utils';
import type { User } from '@/types';

const { Option } = Select;

export default function UserManagement() {
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [filters, setFilters] = useState<{
    role?: User['role'];
    status?: User['status'];
    search?: string;
    page: number;
    page_size: number;
  }>({
    page: 1,
    page_size: 10,
  });

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const data = await userApi.list(filters);
        setUsers(data.items);
        setTotal(data.total);
      } catch {
        // Error handled
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [filters]);

  const refreshUsers = async () => {
    const data = await userApi.list(filters);
    setUsers(data.items);
    setTotal(data.total);
  };

  const handleCreateOrUpdate = async (values: Partial<User> & { password?: string }) => {
    try {
      if (editingUser) {
        await userApi.update(editingUser.id, values);
        message.success('User updated');
      } else {
        await userApi.create(values as Partial<User> & { password: string });
        message.success('User created');
      }
      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      refreshUsers();
    } catch {
      message.error('Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await userApi.delete(id);
      message.success('User deleted');
      refreshUsers();
    } catch {
      message.error('Failed to delete user');
    }
  };

  const handleResetPassword = async (values: { password: string }) => {
    if (!selectedUserId) return;
    try {
      await userApi.resetPassword(selectedUserId, values.password);
      message.success('Password reset successfully');
      setPasswordModalVisible(false);
      setSelectedUserId(null);
      passwordForm.resetFields();
    } catch {
      message.error('Failed to reset password');
    }
  };

  const openEditModal = (user?: User) => {
    setEditingUser(user || null);
    if (user) {
      form.setFieldsValue(user);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const getRoleColor = (role: User['role']) => {
    const colors = { admin: 'red', editor: 'blue', viewer: 'green' };
    return colors[role];
  };

  const columns: TableProps<User>['columns'] = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role) => <Tag color={getRoleColor(role)}>{role}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Button
            type="text"
            icon={<LockOutlined />}
            onClick={() => {
              setSelectedUserId(record.id);
              setPasswordModalVisible(true);
            }}
            title="Reset Password"
          />
          <Popconfirm
            title="Delete User"
            description="Are you sure you want to delete this user?"
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
        title="Users & Permissions"
        subtitle="Manage user accounts and access control"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditModal()}>
            Create User
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search users..."
          prefix={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="Role"
          value={filters.role}
          onChange={(v) => setFilters({ ...filters, role: v, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="admin">Admin</Option>
          <Option value="editor">Editor</Option>
          <Option value="viewer">Viewer</Option>
        </Select>
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={(v) => setFilters({ ...filters, status: v, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="active">Active</Option>
          <Option value="inactive">Inactive</Option>
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          onChange: (page, pageSize) => setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title={editingUser ? 'Edit User' : 'Create User'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateOrUpdate}>
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: 'Please enter username' }]}
          >
            <Input placeholder="Enter username" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="Enter email" />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: 'Please enter password' },
                { min: 8, message: 'Password must be at least 8 characters' },
              ]}
            >
              <Input.Password placeholder="Enter password" />
            </Form.Item>
          )}
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true }]}
            initialValue="viewer"
          >
            <Select>
              <Option value="admin">Admin</Option>
              <Option value="editor">Editor</Option>
              <Option value="viewer">Viewer</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="active">
            <Select>
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingUser ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Reset Password"
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false);
          setSelectedUserId(null);
          passwordForm.resetFields();
        }}
        footer={null}
      >
        <Form form={passwordForm} layout="vertical" onFinish={handleResetPassword}>
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter new password' },
              { min: 8, message: 'Password must be at least 8 characters' },
            ]}
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Reset Password
              </Button>
              <Button onClick={() => setPasswordModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
