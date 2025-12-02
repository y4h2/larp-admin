import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Dropdown,
  Tag,
  message,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  DownloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';
import { useScripts } from '@/hooks';
import { scriptApi, type ScriptExportData } from '@/api/scripts';
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
  } = useScripts();

  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState<{
    difficulty?: Script['difficulty'];
    search?: string;
    page: number;
    page_size: number;
  }>({
    page: 1,
    page_size: 10,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchScripts(filters);
  }, [filters, fetchScripts]);

  const handleExport = async (id: string, title: string) => {
    try {
      const data = await scriptApi.export(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success(t('script.exportSuccess'));
    } catch {
      message.error(t('script.exportFailed'));
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data: ScriptExportData = JSON.parse(text);

      // Validate basic structure
      if (!data.title || !data.version) {
        throw new Error('Invalid export file format');
      }

      await scriptApi.import(data);
      message.success(t('script.importSuccess'));
      fetchScripts(filters);
    } catch (error) {
      console.error('Import error:', error);
      message.error(t('script.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleCreate = async (values: Partial<Script>) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const script = await createScript(values);
      setModalVisible(false);
      form.resetFields();
      fetchScripts(filters);
      navigate(`/scripts/${script.id}`);
    } catch {
      // Error already handled in hook
    } finally {
      setSubmitting(false);
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

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'green';
      case 'medium':
        return 'orange';
      case 'hard':
        return 'red';
      default:
        return 'default';
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
      key: 'export',
      icon: <DownloadOutlined />,
      label: t('script.exportScript'),
      onClick: () => handleExport(record.id, record.title),
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
          content: t('script.deleteConfirm', { name: record.title }),
          okText: t('common.delete'),
          okType: 'danger',
          onOk: () => handleDelete(record.id),
        });
      },
    },
  ];

  const columns: ResizableColumn<Script>[] = [
    {
      title: t('script.scriptTitle'),
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <a onClick={() => navigate(`/scripts/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: t('script.difficulty'),
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 100,
      render: (difficulty) => (
        <Tag color={getDifficultyColor(difficulty)}>{t(`script.${difficulty}`)}</Tag>
      ),
    },
    {
      title: t('script.summary'),
      dataIndex: 'summary',
      key: 'summary',
      width: 300,
      ellipsis: true,
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
          <Space>
            <Button
              icon={<UploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
              loading={importing}
            >
              {t('script.importScript')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              {t('script.createScript')}
            </Button>
          </Space>
        }
      />

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImport(file);
            e.target.value = '';
          }
        }}
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
          placeholder={t('script.difficulty')}
          value={filters.difficulty}
          onChange={(value) => setFilters({ ...filters, difficulty: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="easy">{t('script.easy')}</Option>
          <Option value="medium">{t('script.medium')}</Option>
          <Option value="hard">{t('script.hard')}</Option>
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
            name="title"
            label={t('script.scriptTitle')}
            rules={[{ required: true, message: t('script.enterScriptTitle') }]}
          >
            <Input placeholder={t('script.enterScriptTitle')} />
          </Form.Item>
          <Form.Item name="summary" label={t('script.summary')}>
            <Input.TextArea placeholder={t('script.enterSummary')} rows={3} />
          </Form.Item>
          <Form.Item name="difficulty" label={t('script.difficulty')} initialValue="medium">
            <Select>
              <Option value="easy">{t('script.easy')}</Option>
              <Option value="medium">{t('script.medium')}</Option>
              <Option value="hard">{t('script.hard')}</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting} disabled={submitting}>
                {t('common.create')}
              </Button>
              <Button onClick={() => setModalVisible(false)} disabled={submitting}>{t('common.cancel')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
