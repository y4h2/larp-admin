import { useState, useCallback } from 'react';
import { message } from 'antd';
import {
  templateApi,
  type TemplateQueryParams,
  type TemplateCreateData,
  type TemplateUpdateData,
  type PromptTemplate,
} from '@/api/templates';

export function useTemplates() {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [total, setTotal] = useState(0);

  const fetchTemplates = useCallback(async (params: TemplateQueryParams = {}) => {
    setLoading(true);
    try {
      const response = await templateApi.list(params);
      setTemplates(response.items);
      setTotal(response.total);
      return response;
    } catch (error) {
      message.error('Failed to fetch templates');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (data: TemplateCreateData) => {
    try {
      const template = await templateApi.create(data);
      message.success('Template created successfully');
      return template;
    } catch (error) {
      message.error('Failed to create template');
      throw error;
    }
  }, []);

  const updateTemplate = useCallback(async (id: string, data: TemplateUpdateData) => {
    try {
      const template = await templateApi.update(id, data);
      message.success('Template updated successfully');
      return template;
    } catch (error) {
      message.error('Failed to update template');
      throw error;
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      await templateApi.delete(id);
      message.success('Template deleted successfully');
    } catch (error) {
      message.error('Failed to delete template');
      throw error;
    }
  }, []);

  const duplicateTemplate = useCallback(async (id: string) => {
    try {
      const template = await templateApi.duplicate(id);
      message.success('Template duplicated successfully');
      return template;
    } catch (error) {
      message.error('Failed to duplicate template');
      throw error;
    }
  }, []);

  const setDefaultTemplate = useCallback(async (id: string) => {
    try {
      const template = await templateApi.setDefault(id);
      message.success('Template set as default');
      return template;
    } catch (error) {
      message.error('Failed to set default template');
      throw error;
    }
  }, []);

  return {
    loading,
    templates,
    total,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    setDefaultTemplate,
  };
}
