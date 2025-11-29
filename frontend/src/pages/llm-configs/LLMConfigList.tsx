import { useEffect, useState, useRef } from 'react';
import {
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Dropdown,
  Tag,
  Row,
  Col,
  InputNumber,
  Switch,
  message,
} from 'antd';
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
import { useLLMConfigs } from '@/hooks';
import { llmConfigApi } from '@/api/llmConfigs';
import { formatDate } from '@/utils';
import type {
  LLMConfig,
  LLMConfigType,
  LLMConfigCreateData,
  EmbeddingOptions,
  ChatOptions,
  LLMConfigExportData,
  LLMConfigExportItem,
} from '@/api/llmConfigs';

const { Option } = Select;

const CONFIG_TYPES: LLMConfigType[] = ['embedding', 'chat'];

// Form values type (flat structure for form fields)
interface LLMConfigFormValues {
  name: string;
  type: LLMConfigType;
  model: string;
  base_url: string;
  api_key: string;
  is_default?: boolean;
  // Embedding options
  similarity_threshold?: number;
  dimensions?: number;
  // Chat options
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export default function LLMConfigList() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const {
    loading,
    configs,
    total,
    fetchConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    setDefaultConfig,
  } = useLLMConfigs();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [importing, setImporting] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [pendingImports, setPendingImports] = useState<LLMConfigExportItem[]>([]);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiKeyForm] = Form.useForm();
  const [filters, setFilters] = useState<{
    type?: LLMConfigType;
    search?: string;
    page: number;
    page_size: number;
  }>({
    page: 1,
    page_size: 10,
  });

  const selectedType = Form.useWatch('type', form) as LLMConfigType | undefined;

  useEffect(() => {
    fetchConfigs(filters);
  }, [filters, fetchConfigs]);

  const handleCreate = async (values: LLMConfigFormValues) => {
    try {
      // Build options based on type
      const options: EmbeddingOptions | ChatOptions = {};
      if (values.type === 'embedding') {
        if (values.similarity_threshold !== undefined) {
          (options as EmbeddingOptions).similarity_threshold = values.similarity_threshold;
        }
        if (values.dimensions !== undefined) {
          (options as EmbeddingOptions).dimensions = values.dimensions;
        }
      } else {
        if (values.temperature !== undefined) {
          (options as ChatOptions).temperature = values.temperature;
        }
        if (values.max_tokens !== undefined) {
          (options as ChatOptions).max_tokens = values.max_tokens;
        }
        if (values.top_p !== undefined) {
          (options as ChatOptions).top_p = values.top_p;
        }
      }

      const data: LLMConfigCreateData = {
        name: values.name,
        type: values.type,
        model: values.model,
        base_url: values.base_url,
        api_key: values.api_key,
        is_default: values.is_default,
        options: Object.keys(options).length > 0 ? options : undefined,
      };

      if (editingConfig) {
        await updateConfig(editingConfig.id, {
          name: data.name,
          model: data.model,
          base_url: data.base_url,
          api_key: data.api_key || undefined,
          is_default: data.is_default,
          options: data.options,
        });
      } else {
        await createConfig(data);
      }
      setModalVisible(false);
      setEditingConfig(null);
      form.resetFields();
      fetchConfigs(filters);
    } catch {
      // Error already handled in hook
    }
  };

  const handleEdit = (record: LLMConfig) => {
    setEditingConfig(record);
    const options = record.options || {};
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      model: record.model,
      base_url: record.base_url,
      api_key: '', // Don't show the masked key
      is_default: record.is_default,
      // Spread options based on type
      ...('similarity_threshold' in options && { similarity_threshold: options.similarity_threshold }),
      ...('dimensions' in options && { dimensions: options.dimensions }),
      ...('temperature' in options && { temperature: options.temperature }),
      ...('max_tokens' in options && { max_tokens: options.max_tokens }),
      ...('top_p' in options && { top_p: options.top_p }),
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConfig(id);
      fetchConfigs(filters);
    } catch {
      // Error already handled
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultConfig(id);
      fetchConfigs(filters);
    } catch {
      // Error already handled
    }
  };

  const handleExport = async (id?: string) => {
    try {
      let configsToExport: LLMConfig[];
      if (id) {
        const config = await llmConfigApi.get(id);
        configsToExport = [config];
      } else {
        const response = await llmConfigApi.list({ page_size: 1000 });
        configsToExport = response.items;
      }

      const exportData: LLMConfigExportData = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        configs: configsToExport.map((c) => ({
          name: c.name,
          type: c.type,
          model: c.model,
          base_url: c.base_url,
          api_key: '', // User needs to fill in when importing
          is_default: c.is_default,
          options: c.options,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = id
        ? `llm_config_${configsToExport[0].name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.json`
        : `llm_configs_export_${Date.now()}.json`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      message.success(t('llmConfig.exportSuccess'));
    } catch {
      message.error(t('llmConfig.exportFailed'));
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data: LLMConfigExportData = JSON.parse(text);

      if (!data.version || !data.configs || !Array.isArray(data.configs)) {
        throw new Error('Invalid file format');
      }

      // Get existing config names for deduplication
      const existing = await llmConfigApi.list({ page_size: 1000 });
      const existingNames = new Set(existing.items.map((c) => c.name));

      // Rename duplicates
      const configsToImport = data.configs.map((config) => {
        let name = config.name;
        if (existingNames.has(name)) {
          let suffix = 1;
          while (existingNames.has(`${config.name}_${suffix}`)) {
            suffix++;
          }
          name = `${config.name}_${suffix}`;
        }
        existingNames.add(name);
        return { ...config, name };
      });

      if (configsToImport.length === 0) {
        message.info(t('llmConfig.importFailed'));
        return;
      }

      // Separate configs with api_key already filled vs those needing input
      const configsWithKey = configsToImport.filter((c) => c.api_key && c.api_key.trim() !== '');
      const configsNeedingKey = configsToImport.filter((c) => !c.api_key || c.api_key.trim() === '');

      // Import configs that already have api_key
      let importedWithKey = 0;
      for (const config of configsWithKey) {
        try {
          await llmConfigApi.create({
            name: config.name,
            type: config.type,
            model: config.model,
            base_url: config.base_url,
            api_key: config.api_key,
            is_default: false,
            options: config.options,
          });
          importedWithKey++;
        } catch {
          // Continue with other configs
        }
      }

      if (configsNeedingKey.length === 0) {
        // All configs had api_key, we're done
        if (importedWithKey > 0) {
          message.success(t('llmConfig.importSuccess', { count: importedWithKey }));
        }
        fetchConfigs(filters);
        return;
      }

      // Start the API key input flow for remaining configs
      setPendingImports(configsNeedingKey);
      setCurrentImportIndex(0);
      setImportedCount(importedWithKey);
      setApiKeyModalVisible(true);
      apiKeyForm.resetFields();
    } catch {
      message.error(t('llmConfig.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleImportWithApiKey = async (values: { api_key: string }) => {
    const currentConfig = pendingImports[currentImportIndex];
    let success = false;

    try {
      await llmConfigApi.create({
        name: currentConfig.name,
        type: currentConfig.type,
        model: currentConfig.model,
        base_url: currentConfig.base_url,
        api_key: values.api_key,
        is_default: false,
        options: currentConfig.options,
      });
      success = true;
    } catch {
      message.error(t('llmConfig.createFailed'));
    }

    const newImportedCount = success ? importedCount + 1 : importedCount;
    if (success) {
      setImportedCount(newImportedCount);
    }

    apiKeyForm.resetFields();
    if (currentImportIndex < pendingImports.length - 1) {
      setCurrentImportIndex((prev) => prev + 1);
    } else {
      // All done
      setApiKeyModalVisible(false);
      setPendingImports([]);
      if (newImportedCount > 0) {
        message.success(t('llmConfig.importSuccess', { count: newImportedCount }));
      }
      fetchConfigs(filters);
    }
  };

  const handleSkipImport = () => {
    apiKeyForm.resetFields();
    if (currentImportIndex < pendingImports.length - 1) {
      setCurrentImportIndex((prev) => prev + 1);
    } else {
      // All done
      setApiKeyModalVisible(false);
      setPendingImports([]);
      if (importedCount > 0) {
        message.success(t('llmConfig.importSuccess', { count: importedCount }));
      }
      fetchConfigs(filters);
    }
  };

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
      onClick: () => {
        Modal.confirm({
          title: t('llmConfig.deleteConfig'),
          content: t('llmConfig.deleteConfirm', { name: record.name }),
          okText: t('common.delete'),
          okType: 'danger',
          onOk: () => handleDelete(record.id),
        });
      },
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
            <Button icon={<UploadOutlined />} loading={importing} onClick={() => fileInputRef.current?.click()}>
              {t('llmConfig.importConfig')}
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => handleExport()}>
              {t('llmConfig.exportAll')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditingConfig(null);
              form.resetFields();
              setModalVisible(true);
            }}>
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

      <Modal
        title={editingConfig ? t('llmConfig.editConfig') : t('llmConfig.createConfig')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingConfig(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label={t('llmConfig.configName')}
                rules={[{ required: true, message: t('llmConfig.enterName') }]}
              >
                <Input placeholder={t('llmConfig.configNamePlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label={t('llmConfig.type')}
                rules={[{ required: true, message: t('llmConfig.selectType') }]}
                initialValue="chat"
              >
                <Select disabled={!!editingConfig}>
                  {CONFIG_TYPES.map((type) => (
                    <Option key={type} value={type}>
                      {t(`llmConfig.types.${type}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="model"
            label={t('llmConfig.model')}
            rules={[{ required: true, message: t('llmConfig.enterModel') }]}
          >
            <Input placeholder={t('llmConfig.modelPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="base_url"
            label={t('llmConfig.baseUrl')}
            rules={[{ required: true, message: t('llmConfig.enterBaseUrl') }]}
          >
            <Input placeholder={t('llmConfig.baseUrlPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="api_key"
            label={t('llmConfig.apiKey')}
            rules={[{ required: !editingConfig, message: t('llmConfig.enterApiKey') }]}
            extra={editingConfig ? t('llmConfig.apiKeyEditHint') : undefined}
          >
            <Input.Password placeholder={t('llmConfig.apiKeyPlaceholder')} />
          </Form.Item>

          {/* Options based on type */}
          {selectedType === 'embedding' && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="similarity_threshold"
                  label={t('llmConfig.similarityThreshold')}
                  extra={t('llmConfig.similarityThresholdHint')}
                >
                  <InputNumber
                    min={0}
                    max={1}
                    step={0.1}
                    style={{ width: '100%' }}
                    placeholder="0.7"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="dimensions"
                  label={t('llmConfig.dimensions')}
                  extra={t('llmConfig.dimensionsHint')}
                >
                  <InputNumber
                    min={1}
                    style={{ width: '100%' }}
                    placeholder="1536"
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          {selectedType === 'chat' && (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="temperature"
                    label={t('llmConfig.temperature')}
                  >
                    <InputNumber
                      min={0}
                      max={2}
                      step={0.1}
                      style={{ width: '100%' }}
                      placeholder="0.7"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="max_tokens"
                    label={t('llmConfig.maxTokens')}
                  >
                    <InputNumber
                      min={1}
                      style={{ width: '100%' }}
                      placeholder="4096"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="top_p"
                    label={t('llmConfig.topP')}
                  >
                    <InputNumber
                      min={0}
                      max={1}
                      step={0.1}
                      style={{ width: '100%' }}
                      placeholder="1.0"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Form.Item name="is_default" valuePropName="checked" initialValue={false}>
            <Space>
              <Switch />
              <span>{t('llmConfig.setAsDefault')}</span>
            </Space>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingConfig ? t('common.save') : t('common.create')}
              </Button>
              <Button onClick={() => setModalVisible(false)}>{t('common.cancel')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* API Key Input Modal for Import */}
      <Modal
        title={t('llmConfig.importApiKeyTitle')}
        open={apiKeyModalVisible}
        onCancel={() => {
          setApiKeyModalVisible(false);
          setPendingImports([]);
          if (importedCount > 0) {
            message.success(t('llmConfig.importSuccess', { count: importedCount }));
            fetchConfigs(filters);
          }
        }}
        footer={null}
        maskClosable={false}
      >
        {pendingImports.length > 0 && currentImportIndex < pendingImports.length && (
          <Form form={apiKeyForm} layout="vertical" onFinish={handleImportWithApiKey}>
            <div style={{ marginBottom: 16 }}>
              <Tag color="blue">{currentImportIndex + 1} / {pendingImports.length}</Tag>
              <span style={{ marginLeft: 8 }}>
                {t('llmConfig.importApiKeyHint', { name: pendingImports[currentImportIndex].name })}
              </span>
            </div>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
              <div><strong>{t('llmConfig.model')}:</strong> {pendingImports[currentImportIndex].model}</div>
              <div><strong>{t('llmConfig.baseUrl')}:</strong> {pendingImports[currentImportIndex].base_url}</div>
              <div><strong>{t('llmConfig.type')}:</strong> {t(`llmConfig.types.${pendingImports[currentImportIndex].type}`)}</div>
            </div>
            <Form.Item
              name="api_key"
              label={t('llmConfig.apiKey')}
              rules={[{ required: true, message: t('llmConfig.enterApiKey') }]}
            >
              <Input.Password placeholder={t('llmConfig.apiKeyPlaceholder')} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  {currentImportIndex < pendingImports.length - 1 ? t('common.next') : t('common.confirm')}
                </Button>
                <Button onClick={handleSkipImport}>
                  {t('llmConfig.skipConfig')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
