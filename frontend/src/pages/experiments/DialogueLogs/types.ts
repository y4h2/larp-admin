import type { DialogueLog } from '@/types';

export interface SessionGroup {
  session_id: string;
  username: string | null;
  npc_id: string;
  npc_name: string;
  logs: DialogueLog[];
  total_clues: number;
  first_time: string;
  last_time: string;
}

export interface LogFilters {
  script_id?: string;
  npc_id?: string;
  session_id?: string;
  start_date?: string;
  end_date?: string;
  page: number;
  page_size: number;
}
