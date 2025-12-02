import { useEffect, useState, useRef, useCallback } from 'react';
import { Form, Modal, message } from 'antd';
import { useLLMConfigs } from '@/hooks';
import { llmConfigApi } from '@/api/llmConfigs';
import type {
  LLMConfig,
  LLMConfigCreateData,
  EmbeddingOptions,
  ChatOptions,
  LLMConfigExportData,
  LLMConfigExportItem,
} from '@/api/llmConfigs';
import type { LLMConfigFormValues, ListFilters } from '../types';

export function useLLMConfigList(t: (key: string, params?: Record<string, unknown>) => string) {
  const [form] = Form.useForm();
  const [apiKeyForm] = Form.useForm();
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
  const [submitting, setSubmitting] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [importing, setImporting] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [pendingImports, setPendingImports] = useState<LLMConfigExportItem[]>([]);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<ListFilters>({
    page: 1,
    page_size: 10,
  });

  useEffect(() => {
    fetchConfigs(filters);
  }, [filters, fetchConfigs]);

  const handleCreate = useCallback(async (values: LLMConfigFormValues) => {
    if (submitting) return;
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  }, [submitting, editingConfig, form, filters, updateConfig, createConfig, fetchConfigs]);

  const handleEdit = useCallback((record: LLMConfig) => {
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
  }, [form]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteConfig(id);
      fetchConfigs(filters);
    } catch {
      // Error already handled
    }
  }, [deleteConfig, fetchConfigs, filters]);

  const handleSetDefault = useCallback(async (id: string) => {
    try {
      await setDefaultConfig(id);
      fetchConfigs(filters);
    } catch {
      // Error already handled
    }
  }, [setDefaultConfig, fetchConfigs, filters]);

  const handleExport = useCallback(async (id?: string) => {
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
  }, [t]);

  const handleImport = useCallback(async (file: File) => {
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
  }, [t, filters, fetchConfigs, apiKeyForm]);

  const handleImportWithApiKey = useCallback(async (values: { api_key: string }) => {
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
  }, [t, pendingImports, currentImportIndex, importedCount, apiKeyForm, fetchConfigs, filters]);

  const handleSkipImport = useCallback(() => {
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
  }, [t, currentImportIndex, pendingImports.length, importedCount, apiKeyForm, fetchConfigs, filters]);

  const handleConfirmDelete = useCallback((record: LLMConfig) => {
    Modal.confirm({
      title: t('llmConfig.deleteConfig'),
      content: t('llmConfig.deleteConfirm', { name: record.name }),
      okText: t('common.delete'),
      okType: 'danger',
      onOk: () => handleDelete(record.id),
    });
  }, [t, handleDelete]);

  const openCreateModal = useCallback(() => {
    setEditingConfig(null);
    form.resetFields();
    setModalVisible(true);
  }, [form]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingConfig(null);
    form.resetFields();
  }, [form]);

  const closeApiKeyModal = useCallback(() => {
    setApiKeyModalVisible(false);
    setPendingImports([]);
    if (importedCount > 0) {
      message.success(t('llmConfig.importSuccess', { count: importedCount }));
      fetchConfigs(filters);
    }
  }, [t, importedCount, fetchConfigs, filters]);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImport(file);
      e.target.value = '';
    }
  }, [handleImport]);

  return {
    // Form
    form,
    apiKeyForm,

    // Data
    loading,
    configs,
    total,

    // State
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

    // Handlers
    handleCreate,
    handleEdit,
    handleDelete,
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
  };
}
