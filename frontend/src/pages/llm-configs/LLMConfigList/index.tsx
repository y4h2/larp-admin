import { Button, Space, Input, Select, Dropdown, Tag, Form } from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  EyeInvisibleOutlined,
  UploadOutlined,
  DownloadOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, ResizableTable, type ResizableColumn } from '@/components/common';
import { formatDate } from '@/utils';
import type { LLMConfig, LLMConfigType } from '@/api/llmConfigs';
import { useLLMConfigList } from './hooks';
import { ConfigFormModal, ApiKeyImportModal } from './components';
import { CONFIG_TYPES } from './types';

const { Option } = Select;

export default function LLMConfigList() {
  const { t } = useTranslation();
  const {
    form,
    apiKeyForm,
    loading,
    configs,
    total,
    modalVisible,
    submitting,
    editingConfig,
    importing,
    apiKeyModalVisible,
    pendingImports,
    currentImportIndex,
    filters,
    setFilters,
    fileInputRef,
    handleCreate,
    handleEdit,
    handleSetDefault,
    handleExport,
    handleImportWithApiKey,
    handleSkipImport,
    handleConfirmDelete,
    openCreateModal,
    closeModal,
    closeApiKeyModal,
    triggerFileInput,
    handleFileChange,
  } = useLLMConfigList(t);

  const selectedType = Form.useWatch('type', form) as LLMConfigType | undefined;

  const getTypeColor = (type: LLMConfigType) => {
    switch (type) {
      case 'embedding':
        return 'blue';
      case 'chat':
        return 'green';
      default:
        return 'default';
    }
  };

  const getActionMenu = (record: LLMConfig): MenuProps['items'] => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: t('common.edit'),
      onClick: () => handleEdit(record),
    },
    {
      key: 'export',
      icon: <ExportOutlined />,
      label: t('llmConfig.exportConfig'),
      onClick: () => handleExport(record.id),
    },
    {
      key: 'setDefault',
      icon: <CheckCircleOutlined />,
      label: t('llmConfig.setAsDefault'),
      disabled: record.is_default,
      onClick: () => handleSetDefault(record.id),
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: t('common.delete'),
      danger: true,
      onClick: () => handleConfirmDelete(record),
    },
  ];

  const columns: ResizableColumn<LLMConfig>[] = [
    {
      title: t('llmConfig.configName'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <span>{text}</span>
          {record.is_default && (
            <Tag color="gold">{t('llmConfig.default')}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('llmConfig.type'),
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: LLMConfigType) => (
        <Tag color={getTypeColor(type)}>{t(`llmConfig.types.${type}`)}</Tag>
      ),
    },
    {
      title: t('llmConfig.model'),
      dataIndex: 'model',
      key: 'model',
      width: 200,
    },
    {
      title: t('llmConfig.baseUrl'),
      dataIndex: 'base_url',
      key: 'base_url',
      width: 250,
      ellipsis: true,
    },
    {
      title: t('llmConfig.apiKey'),
      dataIndex: 'api_key_masked',
      key: 'api_key_masked',
      width: 180,
      ellipsis: true,
      render: (masked: string) => (
        <Space style={{ maxWidth: '100%' }}>
          <EyeInvisibleOutlined style={{ flexShrink: 0 }} />
          <span style={{
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {masked}
          </span>
        </Space>
      ),
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
        title={t('llmConfig.title')}
        subtitle={t('llmConfig.subtitle')}
        extra={
          <Space>
            <Button icon={<UploadOutlined />} loading={importing} onClick={triggerFileInput}>
              {t('llmConfig.importConfig')}
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => handleExport()}>
              {t('llmConfig.exportAll')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('llmConfig.createConfig')}
            </Button>
          </Space>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('llmConfig.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 250 }}
          allowClear
        />
        <Select
          placeholder={t('llmConfig.type')}
          value={filters.type}
          onChange={(value) => setFilters({ ...filters, type: value, page: 1 })}
          style={{ width: 150 }}
          allowClear
        >
          {CONFIG_TYPES.map((type) => (
            <Option key={type} value={type}>
              {t(`llmConfig.types.${type}`)}
            </Option>
          ))}
        </Select>
      </Space>

      <ResizableTable
        columns={columns}
        dataSource={configs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          showTotal: (total: number) => t('llmConfig.totalConfigs', { total }),
          onChange: (page: number, pageSize: number) =>
            setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <ConfigFormModal
        visible={modalVisible}
        form={form}
        editingConfig={editingConfig}
        submitting={submitting}
        selectedType={selectedType}
        onFinish={handleCreate}
        onCancel={closeModal}
        t={t}
      />

      <ApiKeyImportModal
        visible={apiKeyModalVisible}
        form={apiKeyForm}
        pendingImports={pendingImports}
        currentImportIndex={currentImportIndex}
        onFinish={handleImportWithApiKey}
        onSkip={handleSkipImport}
        onCancel={closeApiKeyModal}
        t={t}
      />
    </div>
  );
}
