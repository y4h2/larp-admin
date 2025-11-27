import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore, useUIStore } from './index'
import type { Script, NPC, Clue } from '@/types'

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
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
    })
  })

  describe('currentScriptId', () => {
    it('should set current script id', () => {
      const { setCurrentScriptId } = useAppStore.getState()

      setCurrentScriptId('script-123')

      expect(useAppStore.getState().currentScriptId).toBe('script-123')
    })

    it('should clear current script id when set to null', () => {
      const { setCurrentScriptId } = useAppStore.getState()

      setCurrentScriptId('script-123')
      setCurrentScriptId(null)

      expect(useAppStore.getState().currentScriptId).toBeNull()
    })
  })

  describe('currentNpcId', () => {
    it('should set current npc id', () => {
      const { setCurrentNpcId } = useAppStore.getState()

      setCurrentNpcId('npc-456')

      expect(useAppStore.getState().currentNpcId).toBe('npc-456')
    })
  })

  describe('scripts', () => {
    it('should set scripts array', () => {
      const { setScripts } = useAppStore.getState()
      const mockScripts: Script[] = [
        {
          id: 'script-1',
          name: 'Test Script 1',
          description: 'Description 1',
          player_count: 4,
          expected_duration: 60,
          difficulty: 'medium',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'script-2',
          name: 'Test Script 2',
          description: 'Description 2',
          player_count: 6,
          expected_duration: 90,
          difficulty: 'hard',
          created_at: '2024-01-02',
          updated_at: '2024-01-02',
        },
      ]

      setScripts(mockScripts)

      expect(useAppStore.getState().scripts).toEqual(mockScripts)
      expect(useAppStore.getState().scripts).toHaveLength(2)
    })

    it('should get script by id', () => {
      const mockScript: Script = {
        id: 'script-1',
        name: 'Test Script',
        description: 'Test Description',
        player_count: 4,
        expected_duration: 60,
        difficulty: 'easy',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }
      useAppStore.setState({ scripts: [mockScript] })

      const { getScriptById } = useAppStore.getState()

      expect(getScriptById('script-1')).toEqual(mockScript)
      expect(getScriptById('non-existent')).toBeUndefined()
    })
  })

  describe('npcs', () => {
    it('should set npcs array', () => {
      const { setNpcs } = useAppStore.getState()
      const mockNpcs: NPC[] = [
        {
          id: 'npc-1',
          script_id: 'script-1',
          name: 'John Doe',
          name_en: 'John Doe',
          role_type: 'suspect',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ]

      setNpcs(mockNpcs)

      expect(useAppStore.getState().npcs).toEqual(mockNpcs)
    })

    it('should get npc by id', () => {
      const mockNpc: NPC = {
        id: 'npc-1',
        script_id: 'script-1',
        name: 'John Doe',
        name_en: 'John Doe',
        role_type: 'witness',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }
      useAppStore.setState({ npcs: [mockNpc] })

      const { getNpcById } = useAppStore.getState()

      expect(getNpcById('npc-1')).toEqual(mockNpc)
      expect(getNpcById('non-existent')).toBeUndefined()
    })
  })

  describe('clues', () => {
    it('should set clues array', () => {
      const { setClues } = useAppStore.getState()
      const mockClues: Clue[] = [
        {
          id: 'clue-1',
          script_id: 'script-1',
          title_internal: 'Murder Weapon',
          title_player: 'A bloody knife',
          content_text: 'You found a knife',
          content_type: 'text',
          clue_type: 'evidence',
          importance: 'critical',
          stage: 1,
          one_time: false,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ]

      setClues(mockClues)

      expect(useAppStore.getState().clues).toEqual(mockClues)
    })

    it('should get clue by id', () => {
      const mockClue: Clue = {
        id: 'clue-1',
        script_id: 'script-1',
        title_internal: 'Murder Weapon',
        title_player: 'A bloody knife',
        content_text: 'You found a knife',
        content_type: 'text',
        clue_type: 'evidence',
        importance: 'critical',
        stage: 1,
        one_time: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }
      useAppStore.setState({ clues: [mockClue] })

      const { getClueById } = useAppStore.getState()

      expect(getClueById('clue-1')).toEqual(mockClue)
      expect(getClueById('non-existent')).toBeUndefined()
    })
  })

  describe('loading states', () => {
    it('should set loading state for scripts', () => {
      const { setLoading } = useAppStore.getState()

      setLoading('scripts', true)
      expect(useAppStore.getState().loading.scripts).toBe(true)

      setLoading('scripts', false)
      expect(useAppStore.getState().loading.scripts).toBe(false)
    })

    it('should set loading state for npcs', () => {
      const { setLoading } = useAppStore.getState()

      setLoading('npcs', true)
      expect(useAppStore.getState().loading.npcs).toBe(true)
    })

    it('should set loading state for clues', () => {
      const { setLoading } = useAppStore.getState()

      setLoading('clues', true)
      expect(useAppStore.getState().loading.clues).toBe(true)
    })

    it('should preserve other loading states when updating one', () => {
      const { setLoading } = useAppStore.getState()

      setLoading('scripts', true)
      setLoading('npcs', true)
      setLoading('scripts', false)

      const { loading } = useAppStore.getState()
      expect(loading.scripts).toBe(false)
      expect(loading.npcs).toBe(true)
      expect(loading.clues).toBe(false)
    })
  })
})

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      sidebarCollapsed: false,
      theme: 'light',
      language: 'zh',
    })
  })

  describe('sidebarCollapsed', () => {
    it('should set sidebar collapsed state', () => {
      const { setSidebarCollapsed } = useUIStore.getState()

      setSidebarCollapsed(true)
      expect(useUIStore.getState().sidebarCollapsed).toBe(true)

      setSidebarCollapsed(false)
      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })

    it('should toggle sidebar state', () => {
      const { toggleSidebar } = useUIStore.getState()

      expect(useUIStore.getState().sidebarCollapsed).toBe(false)

      toggleSidebar()
      expect(useUIStore.getState().sidebarCollapsed).toBe(true)

      toggleSidebar()
      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })
  })

  describe('theme', () => {
    it('should set theme to light', () => {
      const { setTheme } = useUIStore.getState()

      setTheme('light')
      expect(useUIStore.getState().theme).toBe('light')
    })

    it('should set theme to dark', () => {
      const { setTheme } = useUIStore.getState()

      setTheme('dark')
      expect(useUIStore.getState().theme).toBe('dark')
    })
  })

  describe('language', () => {
    it('should set language to english', () => {
      const { setLanguage } = useUIStore.getState()

      setLanguage('en')
      expect(useUIStore.getState().language).toBe('en')
    })

    it('should set language to chinese', () => {
      const { setLanguage } = useUIStore.getState()

      setLanguage('zh')
      expect(useUIStore.getState().language).toBe('zh')
    })
  })
})
