import { useState, useCallback } from 'react';
import { message } from 'antd';
import { scriptApi, type ScriptQueryParams } from '@/api/scripts';
import type { Script } from '@/types';

export function useScripts() {
  const [loading, setLoading] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [total, setTotal] = useState(0);

  const fetchScripts = useCallback(async (params: ScriptQueryParams = {}) => {
    setLoading(true);
    try {
      const response = await scriptApi.list(params);
      setScripts(response.items);
      setTotal(response.total);
      return response;
    } catch (error) {
      message.error('Failed to fetch scripts');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const createScript = useCallback(async (data: Partial<Script>) => {
    try {
      const script = await scriptApi.create(data);
      message.success('Script created successfully');
      return script;
    } catch (error) {
      message.error('Failed to create script');
      throw error;
    }
  }, []);

  const updateScript = useCallback(async (id: string, data: Partial<Script>) => {
    try {
      const script = await scriptApi.update(id, data);
      message.success('Script updated successfully');
      return script;
    } catch (error) {
      message.error('Failed to update script');
      throw error;
    }
  }, []);

  const deleteScript = useCallback(async (id: string) => {
    try {
      await scriptApi.delete(id);
      message.success('Script deleted successfully');
    } catch (error) {
      message.error('Failed to delete script');
      throw error;
    }
  }, []);

  const copyScript = useCallback(async (id: string) => {
    try {
      const script = await scriptApi.copy(id);
      message.success('Script copied successfully');
      return script;
    } catch (error) {
      message.error('Failed to copy script');
      throw error;
    }
  }, []);

  return {
    loading,
    scripts,
    total,
    fetchScripts,
    createScript,
    updateScript,
    deleteScript,
    copyScript,
  };
}
