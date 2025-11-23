import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Script, Scene, NPC, Clue, AlgorithmStrategy, AlgorithmImplementation } from '@/types';

// App State Store
interface AppState {
  // Current selections
  currentScriptId: string | null;
  currentSceneId: string | null;
  currentNpcId: string | null;

  // Cached data
  scripts: Script[];
  scenes: Scene[];
  npcs: NPC[];
  clues: Clue[];
  strategies: AlgorithmStrategy[];
  implementations: AlgorithmImplementation[];

  // Loading states
  loading: {
    scripts: boolean;
    scenes: boolean;
    npcs: boolean;
    clues: boolean;
    strategies: boolean;
  };

  // Actions
  setCurrentScriptId: (id: string | null) => void;
  setCurrentSceneId: (id: string | null) => void;
  setCurrentNpcId: (id: string | null) => void;

  setScripts: (scripts: Script[]) => void;
  setScenes: (scenes: Scene[]) => void;
  setNpcs: (npcs: NPC[]) => void;
  setClues: (clues: Clue[]) => void;
  setStrategies: (strategies: AlgorithmStrategy[]) => void;
  setImplementations: (implementations: AlgorithmImplementation[]) => void;

  setLoading: (key: keyof AppState['loading'], value: boolean) => void;

  // Helpers
  getScriptById: (id: string) => Script | undefined;
  getSceneById: (id: string) => Scene | undefined;
  getNpcById: (id: string) => NPC | undefined;
  getClueById: (id: string) => Clue | undefined;
  getStrategyById: (id: string) => AlgorithmStrategy | undefined;
}

export const useAppStore = create<AppState>()((set, get) => ({
  // Initial state
  currentScriptId: null,
  currentSceneId: null,
  currentNpcId: null,

  scripts: [],
  scenes: [],
  npcs: [],
  clues: [],
  strategies: [],
  implementations: [],

  loading: {
    scripts: false,
    scenes: false,
    npcs: false,
    clues: false,
    strategies: false,
  },

  // Actions
  setCurrentScriptId: (id) => set({ currentScriptId: id }),
  setCurrentSceneId: (id) => set({ currentSceneId: id }),
  setCurrentNpcId: (id) => set({ currentNpcId: id }),

  setScripts: (scripts) => set({ scripts }),
  setScenes: (scenes) => set({ scenes }),
  setNpcs: (npcs) => set({ npcs }),
  setClues: (clues) => set({ clues }),
  setStrategies: (strategies) => set({ strategies }),
  setImplementations: (implementations) => set({ implementations }),

  setLoading: (key, value) =>
    set((state) => ({
      loading: { ...state.loading, [key]: value },
    })),

  // Helpers
  getScriptById: (id) => get().scripts.find((s) => s.id === id),
  getSceneById: (id) => get().scenes.find((s) => s.id === id),
  getNpcById: (id) => get().npcs.find((n) => n.id === id),
  getClueById: (id) => get().clues.find((c) => c.id === id),
  getStrategyById: (id) => get().strategies.find((s) => s.id === id),
}));

// UI State Store (persisted)
interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'light',
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'larp-admin-ui',
    }
  )
);
