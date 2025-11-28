import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { autoMerge, type MergeResult } from '@/utils/autoMerge';

type TableName = 'scripts' | 'npcs' | 'clues';

// Define the payload type locally since it's not exported from @supabase/supabase-js
interface PostgresChangesPayload<T> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  schema: string;
  table: string;
  commit_timestamp: string;
  errors: string[] | null;
}

interface UseRealtimeSyncOptions<T> {
  table: TableName;
  id: string;
  initialData: T | null;
  onRemoteChange?: (data: T, mergeResult: MergeResult<T>) => void;
  enabled?: boolean;
}

interface UseRealtimeSyncReturn<T> {
  data: T | null;
  setLocalData: (data: T) => void;
  lastMergeResult: MergeResult<T> | null;
  isConnected: boolean;
  remoteVersion: number;
}

export function useRealtimeSync<T extends object>({
  table,
  id,
  initialData,
  onRemoteChange,
  enabled = true,
}: UseRealtimeSyncOptions<T>): UseRealtimeSyncReturn<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [lastMergeResult, setLastMergeResult] = useState<MergeResult<T> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState(0);

  // Track the base data (last confirmed server state)
  const baseDataRef = useRef<T | null>(initialData);
  // Track local changes
  const localDataRef = useRef<T | null>(initialData);

  // Update base data when initial data changes
  useEffect(() => {
    setData(initialData);
    baseDataRef.current = initialData;
    localDataRef.current = initialData;
  }, [initialData]);

  // Set local data and track it
  const setLocalData = useCallback((newData: T) => {
    localDataRef.current = newData;
    setData(newData);
  }, []);

  // Handle remote changes
  const handleRemoteChange = useCallback(
    (payload: PostgresChangesPayload<T>) => {
      if (payload.eventType !== 'UPDATE' || !payload.new) {
        return;
      }

      const remoteData = payload.new as T;
      const baseData = baseDataRef.current;
      const localData = localDataRef.current;

      // Perform auto-merge
      const mergeResult = autoMerge(baseData, localData, remoteData);

      // Update the base to the new remote data
      baseDataRef.current = remoteData;
      setRemoteVersion((v) => v + 1);
      setLastMergeResult(mergeResult);

      // Update local data with merged result
      if (mergeResult.merged) {
        localDataRef.current = mergeResult.merged;
        setData(mergeResult.merged);
      }

      // Notify parent component
      if (onRemoteChange) {
        onRemoteChange(remoteData, mergeResult);
      }
    },
    [onRemoteChange]
  );

  // Subscribe to realtime changes
  useEffect(() => {
    if (!enabled || !id) {
      return;
    }

    const channel = supabase
      .channel(`${table}:${id}`)
      .on(
        'postgres_changes' as const,
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `id=eq.${id}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          handleRemoteChange(payload as PostgresChangesPayload<T>);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
    };
  }, [table, id, enabled, handleRemoteChange]);

  return {
    data,
    setLocalData,
    lastMergeResult,
    isConnected,
    remoteVersion,
  };
}
