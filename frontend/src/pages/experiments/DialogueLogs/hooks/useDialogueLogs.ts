import { useEffect, useState, useMemo, useCallback } from 'react';
import { logApi, templateApi, llmConfigApi, type PromptTemplate, type LLMConfig } from '@/api';
import { useScripts, useNpcs } from '@/hooks';
import type { DialogueLog } from '@/types';
import type { SessionGroup, LogFilters } from '../types';

export function useDialogueLogs() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<DialogueLog[]>([]);
  const [total, setTotal] = useState(0);
  const { scripts, fetchScripts } = useScripts();
  const { npcs, fetchNpcs } = useNpcs();
  const [selectedLog, setSelectedLog] = useState<DialogueLog | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupBySession, setGroupBySession] = useState(true);

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([]);

  const [filters, setFilters] = useState<LogFilters>({
    page: 1,
    page_size: 50,
  });

  useEffect(() => {
    fetchScripts();
    fetchNpcs();
    templateApi.list({ page_size: 100 }).then((res) => {
      setTemplates(res?.items ?? []);
    }).catch(() => setTemplates([]));
    llmConfigApi.list({ page_size: 100 }).then((res) => {
      setLlmConfigs(res?.items ?? []);
    }).catch(() => setLlmConfigs([]));
  }, [fetchScripts, fetchNpcs]);

  const filteredNpcs = useMemo(() => {
    return filters.script_id
      ? npcs.filter((n) => n.script_id === filters.script_id)
      : npcs;
  }, [npcs, filters.script_id]);

  const getNpcName = useCallback((npcId: string) => {
    const npc = npcs.find((n) => n.id === npcId);
    return npc?.name || npcId;
  }, [npcs]);

  const getTemplate = useCallback((templateId: string | undefined | null) => {
    if (!templateId) return null;
    return templates.find((t) => t.id === templateId) || null;
  }, [templates]);

  const getLlmConfig = useCallback((configId: string | undefined | null) => {
    if (!configId) return null;
    return llmConfigs.find((c) => c.id === configId) || null;
  }, [llmConfigs]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const data = await logApi.list(filters);
        setLogs(data.items);
        setTotal(data.total);
      } catch {
        // Error handled
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [filters]);

  const sessionGroups = useMemo((): SessionGroup[] => {
    const groups = new Map<string, SessionGroup>();
    logs.forEach((log) => {
      const key = log.session_id;
      if (!groups.has(key)) {
        groups.set(key, {
          session_id: log.session_id,
          username: log.username || null,
          npc_id: log.npc_id,
          npc_name: getNpcName(log.npc_id),
          logs: [],
          total_clues: 0,
          first_time: log.created_at,
          last_time: log.created_at,
        });
      }
      const group = groups.get(key)!;
      group.logs.push(log);
      group.total_clues += log.matched_clues?.length || 0;
      if (new Date(log.created_at) < new Date(group.first_time)) {
        group.first_time = log.created_at;
      }
      if (new Date(log.created_at) > new Date(group.last_time)) {
        group.last_time = log.created_at;
      }
    });
    groups.forEach((group) => {
      group.logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime()
    );
  }, [logs, getNpcName]);

  const openLogDetail = useCallback((log: DialogueLog) => {
    setSelectedLog(log);
    setModalVisible(true);
  }, []);

  const closeLogDetail = useCallback(() => {
    setModalVisible(false);
  }, []);

  return {
    loading,
    logs,
    total,
    scripts,
    filteredNpcs,
    selectedLog,
    modalVisible,
    groupBySession,
    setGroupBySession,
    filters,
    setFilters,
    sessionGroups,
    getNpcName,
    getTemplate,
    getLlmConfig,
    openLogDetail,
    closeLogDetail,
  };
}
