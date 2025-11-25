import { useState, useCallback, useEffect } from 'react';
import type { MatchingStrategy } from '@/types';

// Storage keys
const HISTORY_KEY = 'dialogue-simulation-history';
const FAVORITES_KEY = 'dialogue-simulation-favorites';

// Limits
const MAX_HISTORY = 10;

// Config structure (same as in DialogueSimulation)
export interface PresetConfig {
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
}

export interface HistoryPreset {
  id: string;
  name: string; // Auto-generated: "Script · NPC · Strategy"
  createdAt: number;
  config: PresetConfig;
}

export interface FavoritePreset {
  id: string;
  name: string; // User-defined
  note?: string; // Optional user note
  createdAt: number;
  config: PresetConfig;
}

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Check if two configs are essentially the same (for deduplication)
const isSameConfig = (a: PresetConfig, b: PresetConfig): boolean => {
  return (
    a.selectedScriptId === b.selectedScriptId &&
    a.selectedNpcId === b.selectedNpcId &&
    a.matchingStrategy === b.matchingStrategy &&
    a.enableNpcReply === b.enableNpcReply &&
    a.matchingTemplateId === b.matchingTemplateId &&
    a.matchingLlmConfigId === b.matchingLlmConfigId &&
    a.npcClueTemplateId === b.npcClueTemplateId &&
    a.npcNoClueTemplateId === b.npcNoClueTemplateId &&
    a.npcChatConfigId === b.npcChatConfigId &&
    a.overrideSimilarityThreshold === b.overrideSimilarityThreshold &&
    a.overrideTemperature === b.overrideTemperature
  );
};

export function usePresets() {
  const [history, setHistory] = useState<HistoryPreset[]>([]);
  const [favorites, setFavorites] = useState<FavoritePreset[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(HISTORY_KEY);
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch {
      // Ignore parse errors
    }

    try {
      const storedFavorites = localStorage.getItem(FAVORITES_KEY);
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save history to localStorage
  const saveHistoryToStorage = useCallback((newHistory: HistoryPreset[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save favorites to localStorage
  const saveFavoritesToStorage = useCallback((newFavorites: FavoritePreset[]) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Add to history (called when sending a message)
  const addToHistory = useCallback((
    config: PresetConfig,
    displayName: string // e.g., "西山别墅案 · 管家王伯 · 向量匹配"
  ) => {
    setHistory((prev) => {
      // Check if same config already exists
      const existingIndex = prev.findIndex((h) => isSameConfig(h.config, config));

      let newHistory: HistoryPreset[];

      if (existingIndex >= 0) {
        // Move existing to top and update timestamp
        const existing = prev[existingIndex];
        const updated = { ...existing, createdAt: Date.now(), name: displayName };
        newHistory = [updated, ...prev.filter((_, i) => i !== existingIndex)];
      } else {
        // Add new entry
        const newPreset: HistoryPreset = {
          id: generateId(),
          name: displayName,
          createdAt: Date.now(),
          config,
        };
        newHistory = [newPreset, ...prev];
      }

      // Limit to MAX_HISTORY
      if (newHistory.length > MAX_HISTORY) {
        newHistory = newHistory.slice(0, MAX_HISTORY);
      }

      saveHistoryToStorage(newHistory);
      return newHistory;
    });
  }, [saveHistoryToStorage]);

  // Add to favorites (user action)
  const addToFavorites = useCallback((config: PresetConfig, name: string, note?: string) => {
    const newFavorite: FavoritePreset = {
      id: generateId(),
      name,
      note: note || undefined,
      createdAt: Date.now(),
      config,
    };

    setFavorites((prev) => {
      const newFavorites = [newFavorite, ...prev];
      saveFavoritesToStorage(newFavorites);
      return newFavorites;
    });
  }, [saveFavoritesToStorage]);

  // Update favorite (name and/or note)
  const updateFavorite = useCallback((id: string, updates: { name?: string; note?: string }) => {
    setFavorites((prev) => {
      const newFavorites = prev.map((f) => {
        if (f.id === id) {
          return {
            ...f,
            name: updates.name !== undefined ? updates.name : f.name,
            note: updates.note !== undefined ? updates.note : f.note,
          };
        }
        return f;
      });
      saveFavoritesToStorage(newFavorites);
      return newFavorites;
    });
  }, [saveFavoritesToStorage]);

  // Remove from favorites
  const removeFromFavorites = useCallback((id: string) => {
    setFavorites((prev) => {
      const newFavorites = prev.filter((f) => f.id !== id);
      saveFavoritesToStorage(newFavorites);
      return newFavorites;
    });
  }, [saveFavoritesToStorage]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistoryToStorage([]);
  }, [saveHistoryToStorage]);

  // Get preset by ID (from either history or favorites)
  const getPresetById = useCallback((id: string): PresetConfig | null => {
    const fromHistory = history.find((h) => h.id === id);
    if (fromHistory) return fromHistory.config;

    const fromFavorites = favorites.find((f) => f.id === id);
    if (fromFavorites) return fromFavorites.config;

    return null;
  }, [history, favorites]);

  return {
    history,
    favorites,
    addToHistory,
    addToFavorites,
    updateFavorite,
    removeFromFavorites,
    clearHistory,
    getPresetById,
  };
}
