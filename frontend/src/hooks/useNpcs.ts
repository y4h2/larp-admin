import { useState, useCallback } from 'react';
import { message } from 'antd';
import { npcApi, type NPCQueryParams } from '@/api/npcs';
import type { NPC } from '@/types';
import { useAppStore } from '@/store';

export function useNpcs() {
  const [loading, setLoading] = useState(false);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [total, setTotal] = useState(0);
  const { setNpcs: setGlobalNpcs } = useAppStore();

  const fetchNpcs = useCallback(async (params: NPCQueryParams = {}) => {
    setLoading(true);
    try {
      const response = await npcApi.list(params);
      setNpcs(response.items);
      setTotal(response.total);
      setGlobalNpcs(response.items);
      return response;
    } catch (error) {
      message.error('Failed to fetch NPCs');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setGlobalNpcs]);

  const fetchNpc = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const npc = await npcApi.get(id);
      return npc;
    } catch (error) {
      message.error('Failed to fetch NPC');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const createNpc = useCallback(async (data: Partial<NPC>) => {
    try {
      const npc = await npcApi.create(data);
      message.success('NPC created successfully');
      return npc;
    } catch (error) {
      message.error('Failed to create NPC');
      throw error;
    }
  }, []);

  const updateNpc = useCallback(async (id: string, data: Partial<NPC>) => {
    try {
      const npc = await npcApi.update(id, data);
      message.success('NPC updated successfully');
      return npc;
    } catch (error) {
      message.error('Failed to update NPC');
      throw error;
    }
  }, []);

  const deleteNpc = useCallback(async (id: string) => {
    try {
      await npcApi.delete(id);
      message.success('NPC deleted successfully');
    } catch (error) {
      message.error('Failed to delete NPC');
      throw error;
    }
  }, []);

  return {
    loading,
    npcs,
    total,
    fetchNpcs,
    fetchNpc,
    createNpc,
    updateNpc,
    deleteNpc,
  };
}
