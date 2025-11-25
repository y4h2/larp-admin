import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Script, NPC, Clue } from '@/types';

// App State Store
interface AppState {
  // Current selections
  currentScriptId: string | null;
  currentNpcId: string | null;

  // Cached data
  scripts: Script[];
  npcs: NPC[];
  clues: Clue[];

  // Loading states
  loading: {
    scripts: boolean;
    npcs: boolean;
    clues: boolean;
  };

  // Actions
  setCurrentScriptId: (id: string | null) => void;
  setCurrentNpcId: (id: string | null) => void;

  setScripts: (scripts: Script[]) => void;
  setNpcs: (npcs: NPC[]) => void;
  setClues: (clues: Clue[]) => void;

  setLoading: (key: keyof AppState['loading'], value: boolean) => void;

  // Helpers
  getScriptById: (id: string) => Script | undefined;
  getNpcById: (id: string) => NPC | undefined;
  getClueById: (id: string) => Clue | undefined;
}

export const useAppStore = create<AppState>()((set, get) => ({
  // Initial state
  currentScriptId: null,
  currentNpcId: null,

  scripts: [],
  npcs: [],
  clues: [],

  loading: {
    scripts: false,
    npcs: false,
    clues: false,
  },

  // Actions
  setCurrentScriptId: (id) => set({ currentScriptId: id }),
  setCurrentNpcId: (id) => set({ currentNpcId: id }),

  setScripts: (scripts) => set({ scripts }),
  setNpcs: (npcs) => set({ npcs }),
  setClues: (clues) => set({ clues }),

  setLoading: (key, value) =>
    set((state) => ({
      loading: { ...state.loading, [key]: value },
    })),

  // Helpers
  getScriptById: (id) => get().scripts.find((s) => s.id === id),
  getNpcById: (id) => get().npcs.find((n) => n.id === id),
  getClueById: (id) => get().clues.find((c) => c.id === id),
}));

// UI State Store (persisted)
interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  language: 'en' | 'zh';
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: 'en' | 'zh') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'light',
      language: 'zh',
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'larp-admin-ui',
    }
  )
);
