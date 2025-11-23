import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        message.success(t('users.userUpdated'));
      } else {
        await userApi.create(values as Partial<User> & { password: string });
        message.success(t('users.userCreated'));
      }
      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      refreshUsers();
    } catch {
      message.error(t('users.operationFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await userApi.delete(id);
      message.success(t('users.userDeleted'));
      refreshUsers();
    } catch {
      message.error(t('users.operationFailed'));
    }
  };

  const handleResetPassword = async (values: { password: string }) => {
    if (!selectedUserId) return;
    try {
      await userApi.resetPassword(selectedUserId, values.password);
      message.success(t('users.passwordResetSuccess'));
      setPasswordModalVisible(false);
      setSelectedUserId(null);
      passwordForm.resetFields();
    } catch {
      message.error(t('users.passwordResetFailed'));
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
      title: t('users.username'),
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: t('users.email'),
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: t('users.role'),
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role) => <Tag color={getRoleColor(role)}>{t(`users.${role}`)}</Tag>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: t('users.created'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => formatDate(date),
    },
    {
      title: t('common.actions'),
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
            title={t('users.resetPassword')}
          />
          <Popconfirm
            title={t('users.deleteUser')}
            description={t('users.deleteUserConfirm')}
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
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditModal()}>
            {t('users.createUser')}
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('users.searchUsers')}
          prefix={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder={t('users.role')}
          value={filters.role}
          onChange={(v) => setFilters({ ...filters, role: v, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="admin">{t('users.admin')}</Option>
          <Option value="editor">{t('users.editor')}</Option>
          <Option value="viewer">{t('users.viewer')}</Option>
        </Select>
        <Select
          placeholder={t('common.status')}
          value={filters.status}
          onChange={(v) => setFilters({ ...filters, status: v, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="active">{t('users.active')}</Option>
          <Option value="inactive">{t('users.inactive')}</Option>
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
        title={editingUser ? t('users.editUser') : t('users.createUser')}
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
            label={t('users.username')}
            rules={[{ required: true, message: t('users.enterUsername') }]}
          >
            <Input placeholder={t('users.enterUsername')} disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('users.email')}
            rules={[
              { required: true, message: t('users.enterEmail') },
              { type: 'email', message: t('users.validEmail') },
            ]}
          >
            <Input placeholder={t('users.enterEmail')} />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label={t('users.password')}
              rules={[
                { required: true, message: t('users.enterPassword') },
                { min: 8, message: t('users.passwordMinLength') },
              ]}
            >
              <Input.Password placeholder={t('users.enterPassword')} />
            </Form.Item>
          )}
          <Form.Item
            name="role"
            label={t('users.role')}
            rules={[{ required: true }]}
            initialValue="viewer"
          >
            <Select>
              <Option value="admin">{t('users.admin')}</Option>
              <Option value="editor">{t('users.editor')}</Option>
              <Option value="viewer">{t('users.viewer')}</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label={t('common.status')} initialValue="active">
            <Select>
              <Option value="active">{t('users.active')}</Option>
              <Option value="inactive">{t('users.inactive')}</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingUser ? t('common.save') : t('common.create')}
              </Button>
              <Button onClick={() => setModalVisible(false)}>{t('common.cancel')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('users.resetPassword')}
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
            label={t('users.newPassword')}
            rules={[
              { required: true, message: t('users.enterNewPassword') },
              { min: 8, message: t('users.passwordMinLength') },
            ]}
          >
            <Input.Password placeholder={t('users.enterNewPassword')} />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t('users.confirmPassword')}
            dependencies={['password']}
            rules={[
              { required: true, message: t('users.confirmNewPassword') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('users.passwordsNotMatch')));
                },
              }),
            ]}
          >
            <Input.Password placeholder={t('users.confirmNewPassword')} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('users.resetPassword')}
              </Button>
              <Button onClick={() => setPasswordModalVisible(false)}>{t('common.cancel')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
