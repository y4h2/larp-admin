import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Dropdown,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  InboxOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, StatusTag, ResizableTable, type ResizableColumn } from '@/components/common';
import { useScripts } from '@/hooks';
import { formatDate } from '@/utils';
import type { Script } from '@/types';

const { Option } = Select;

export default function ScriptList() {
  const { t } = useTranslation();
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
      label: t('common.edit'),
      onClick: () => navigate(`/scripts/${record.id}`),
    },
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: t('common.copy'),
      onClick: () => handleCopy(record.id),
    },
    {
      key: 'archive',
      icon: <InboxOutlined />,
      label: t('common.archive'),
      onClick: () => handleArchive(record.id),
      disabled: record.status === 'archived',
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: t('common.delete'),
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: t('script.deleteScript'),
          content: t('script.deleteConfirm', { name: record.name }),
          okText: t('common.delete'),
          okType: 'danger',
          onOk: () => handleDelete(record.id),
        });
      },
    },
  ];

  const columns: ResizableColumn<Script>[] = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/scripts/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: t('common.version'),
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (version) => `v${version}`,
    },
    {
      title: t('common.creator'),
      dataIndex: 'created_by',
      key: 'created_by',
      width: 120,
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
        title={t('script.title')}
        subtitle={t('script.subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            {t('script.createScript')}
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('script.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 250 }}
          allowClear
        />
        <Select
          placeholder={t('common.status')}
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="draft">{t('script.draft')}</Option>
          <Option value="test">{t('script.test')}</Option>
          <Option value="online">{t('script.online')}</Option>
          <Option value="archived">{t('script.archived')}</Option>
        </Select>
      </Space>

      <ResizableTable
        columns={columns}
        dataSource={scripts}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          showTotal: (total: number) => t('script.totalScripts', { total }),
          onChange: (page: number, pageSize: number) =>
            setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title={t('script.createScript')}
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
            label={t('script.scriptName')}
            rules={[{ required: true, message: t('script.enterScriptName') }]}
          >
            <Input placeholder={t('script.enterScriptName')} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea placeholder={t('script.enterDescription')} rows={3} />
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
