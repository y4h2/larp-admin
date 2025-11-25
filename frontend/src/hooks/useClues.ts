import { useState, useCallback } from 'react';
import { message } from 'antd';
import { clueApi, type ClueQueryParams, type ClueTreeData } from '@/api/clues';
import type { Clue } from '@/types';
import { useAppStore } from '@/store';

export function useClues() {
  const [loading, setLoading] = useState(false);
  const [clues, setClues] = useState<Clue[]>([]);
  const [total, setTotal] = useState(0);
  const { setClues: setGlobalClues } = useAppStore();

  const fetchClues = useCallback(async (params: ClueQueryParams = {}) => {
    setLoading(true);
    try {
      const response = await clueApi.list(params);
      setClues(response.items);
      setTotal(response.total);
      setGlobalClues(response.items);
      return response;
    } catch (error) {
      message.error('Failed to fetch clues');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setGlobalClues]);

  const fetchClue = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const clue = await clueApi.get(id);
      return clue;
    } catch (error) {
      message.error('Failed to fetch clue');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const createClue = useCallback(async (data: Partial<Clue>) => {
    try {
      const clue = await clueApi.create(data);
      message.success('Clue created successfully');
      return clue;
    } catch (error) {
      message.error('Failed to create clue');
      throw error;
    }
  }, []);

  const updateClue = useCallback(async (id: string, data: Partial<Clue>) => {
    try {
      const clue = await clueApi.update(id, data);
      message.success('Clue updated successfully');
      return clue;
    } catch (error) {
      message.error('Failed to update clue');
      throw error;
    }
  }, []);

  const deleteClue = useCallback(async (id: string) => {
    try {
      await clueApi.delete(id);
      message.success('Clue deleted successfully');
    } catch (error) {
      message.error('Failed to delete clue');
      throw error;
    }
  }, []);

  return {
    loading,
    clues,
    total,
    fetchClues,
    fetchClue,
    createClue,
    updateClue,
    deleteClue,
  };
}

export function useClueTree() {
  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<ClueTreeData | null>(null);

  const fetchTree = useCallback(async (scriptId: string) => {
    setLoading(true);
    try {
      const response = await clueApi.getTree(scriptId);
      setTreeData(response);
      return response;
    } catch (error) {
      message.error('Failed to fetch clue tree');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDependencies = useCallback(async (clueId: string, prereqClueIds: string[]) => {
    try {
      const clue = await clueApi.updateDependencies(clueId, prereqClueIds);
      message.success('Dependencies updated successfully');
      return clue;
    } catch (error) {
      message.error('Failed to update dependencies');
      throw error;
    }
  }, []);

  return {
    loading,
    treeData,
    fetchTree,
    updateDependencies,
  };
}
