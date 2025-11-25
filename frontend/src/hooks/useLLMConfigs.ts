import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  llmConfigApi,
  type LLMConfigQueryParams,
  type LLMConfigCreateData,
  type LLMConfigUpdateData,
  type LLMConfig,
} from '@/api/llmConfigs';

export function useLLMConfigs() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [total, setTotal] = useState(0);

  const fetchConfigs = useCallback(async (params: LLMConfigQueryParams = {}) => {
    setLoading(true);
    try {
      const response = await llmConfigApi.list(params);
      setConfigs(response.items);
      setTotal(response.total);
      return response;
    } catch (error) {
      message.error(t('llmConfig.loadFailed'));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [t]);

  const createConfig = useCallback(async (data: LLMConfigCreateData) => {
    try {
      const config = await llmConfigApi.create(data);
      message.success(t('llmConfig.createSuccess'));
      return config;
    } catch (error) {
      message.error(t('llmConfig.createFailed'));
      throw error;
    }
  }, [t]);

  const updateConfig = useCallback(async (id: string, data: LLMConfigUpdateData) => {
    try {
      const config = await llmConfigApi.update(id, data);
      message.success(t('common.saveSuccess'));
      return config;
    } catch (error) {
      message.error(t('common.saveFailed'));
      throw error;
    }
  }, [t]);

  const deleteConfig = useCallback(async (id: string) => {
    try {
      await llmConfigApi.delete(id);
      message.success(t('llmConfig.deleteSuccess'));
    } catch (error) {
      message.error(t('llmConfig.deleteFailed'));
      throw error;
    }
  }, [t]);

  const setDefaultConfig = useCallback(async (id: string) => {
    try {
      const config = await llmConfigApi.setDefault(id);
      message.success(t('llmConfig.setDefaultSuccess'));
      return config;
    } catch (error) {
      message.error(t('llmConfig.setDefaultFailed'));
      throw error;
    }
  }, [t]);

  const getDefaults = useCallback(async () => {
    try {
      return await llmConfigApi.getDefaults();
    } catch (error) {
      message.error(t('llmConfig.loadFailed'));
      throw error;
    }
  }, [t]);

  return {
    loading,
    configs,
    total,
    fetchConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    setDefaultConfig,
    getDefaults,
  };
}
