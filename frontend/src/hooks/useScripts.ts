import { useState, useCallback } from 'react';
import { message } from 'antd';
import { scriptApi, sceneApi, type ScriptQueryParams, type SceneQueryParams } from '@/api/scripts';
import type { Script, Scene } from '@/types';
import { useAppStore } from '@/store';

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

  const archiveScript = useCallback(async (id: string) => {
    try {
      const script = await scriptApi.archive(id);
      message.success('Script archived successfully');
      return script;
    } catch (error) {
      message.error('Failed to archive script');
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
    archiveScript,
  };
}

export function useScenes() {
  const [loading, setLoading] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [total, setTotal] = useState(0);
  const { setScenes: setGlobalScenes } = useAppStore();

  const fetchScenes = useCallback(async (params: SceneQueryParams) => {
    setLoading(true);
    try {
      const response = await sceneApi.list(params);
      setScenes(response.items);
      setTotal(response.total);
      setGlobalScenes(response.items);
      return response;
    } catch (error) {
      message.error('Failed to fetch scenes');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setGlobalScenes]);

  const createScene = useCallback(async (data: Partial<Scene>) => {
    try {
      const scene = await sceneApi.create(data);
      message.success('Scene created successfully');
      return scene;
    } catch (error) {
      message.error('Failed to create scene');
      throw error;
    }
  }, []);

  const updateScene = useCallback(async (id: string, data: Partial<Scene>) => {
    try {
      const scene = await sceneApi.update(id, data);
      message.success('Scene updated successfully');
      return scene;
    } catch (error) {
      message.error('Failed to update scene');
      throw error;
    }
  }, []);

  const deleteScene = useCallback(async (id: string) => {
    try {
      await sceneApi.delete(id);
      message.success('Scene deleted successfully');
    } catch (error) {
      message.error('Failed to delete scene');
      throw error;
    }
  }, []);

  const reorderScenes = useCallback(async (scriptId: string, sceneIds: string[]) => {
    try {
      await sceneApi.reorder(scriptId, sceneIds);
      message.success('Scenes reordered successfully');
    } catch (error) {
      message.error('Failed to reorder scenes');
      throw error;
    }
  }, []);

  return {
    loading,
    scenes,
    total,
    fetchScenes,
    createScene,
    updateScene,
    deleteScene,
    reorderScenes,
  };
}
