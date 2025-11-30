import type { SimulationResult, MatchingStrategy } from '@/types';

// LocalStorage key for persisting configuration
export const STORAGE_KEY = 'dialogue-simulation-config';

// Vector backend options
export type VectorBackend = 'chroma' | 'pgvector';

export interface StoredConfig {
  selectedScriptId: string | null;
  selectedNpcId: string | null;
  matchingStrategy: MatchingStrategy;
  matchingTemplateId: string | undefined;
  matchingLlmConfigId: string | undefined;
  enableNpcReply: boolean;
  npcClueTemplateId: string | undefined;
  npcNoClueTemplateId: string | undefined;
  npcChatConfigId: string | undefined;
  // Runtime override options
  overrideSimilarityThreshold: number | undefined;
  overrideTemperature: number | undefined;
  overrideMaxTokens: number | undefined;
  overrideVectorBackend: VectorBackend | undefined;
  // LLM matching options
  llmReturnAllScores: boolean;
  llmScoreThreshold: number | undefined;
}

export interface ChatMessage {
  role: 'player' | 'system' | 'npc';
  content: string;
  result?: SimulationResult;
  // For NPC messages: indicates if clues were triggered
  hasTriggeredClues?: boolean;
  triggeredClueCount?: number;
  // Timestamp for display
  timestamp?: number;
}

export const loadStoredConfig = (): Partial<StoredConfig> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
};

export const saveConfig = (config: StoredConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
};
