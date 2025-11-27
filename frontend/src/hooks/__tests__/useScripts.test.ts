import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useScripts } from '../useScripts'
import { scriptApi } from '@/api/scripts'
import type { Script, PaginatedResponse } from '@/types'

// Mock the script API
vi.mock('@/api/scripts', () => ({
  scriptApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    copy: vi.fn(),
  },
}))

// Mock antd message
vi.mock('antd', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('useScripts', () => {
  const mockScript: Script = {
    id: 'script-1',
    name: 'Test Script',
    description: 'A test script',
    player_count: 4,
    expected_duration: 60,
    difficulty: 'medium',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  const mockPaginatedResponse: PaginatedResponse<Script> = {
    items: [mockScript],
    total: 1,
    page: 1,
    page_size: 10,
    total_pages: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useScripts())

      expect(result.current.loading).toBe(false)
      expect(result.current.scripts).toEqual([])
      expect(result.current.total).toBe(0)
    })
  })

  describe('fetchScripts', () => {
    it('should fetch scripts successfully', async () => {
      vi.mocked(scriptApi.list).mockResolvedValue(mockPaginatedResponse)

      const { result } = renderHook(() => useScripts())

      await act(async () => {
        await result.current.fetchScripts()
      })

      expect(scriptApi.list).toHaveBeenCalledWith({})
      expect(result.current.scripts).toEqual([mockScript])
      expect(result.current.total).toBe(1)
      expect(result.current.loading).toBe(false)
    })

    it('should fetch scripts with params', async () => {
      vi.mocked(scriptApi.list).mockResolvedValue(mockPaginatedResponse)

      const { result } = renderHook(() => useScripts())

      await act(async () => {
        await result.current.fetchScripts({ page: 2, page_size: 20, difficulty: 'hard' })
      })

      expect(scriptApi.list).toHaveBeenCalledWith({
        page: 2,
        page_size: 20,
        difficulty: 'hard',
      })
    })

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: PaginatedResponse<Script>) => void
      const pendingPromise = new Promise<PaginatedResponse<Script>>((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(scriptApi.list).mockReturnValue(pendingPromise)

      const { result } = renderHook(() => useScripts())

      act(() => {
        result.current.fetchScripts()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      await act(async () => {
        resolvePromise!(mockPaginatedResponse)
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    it('should handle fetch error', async () => {
      const error = new Error('Network error')
      vi.mocked(scriptApi.list).mockRejectedValue(error)

      const { result } = renderHook(() => useScripts())

      await expect(
        act(async () => {
          await result.current.fetchScripts()
        })
      ).rejects.toThrow('Network error')

      expect(result.current.loading).toBe(false)
    })
  })

  describe('createScript', () => {
    it('should create script successfully', async () => {
      vi.mocked(scriptApi.create).mockResolvedValue(mockScript)

      const { result } = renderHook(() => useScripts())

      let createdScript: Script | undefined
      await act(async () => {
        createdScript = await result.current.createScript({
          name: 'New Script',
          description: 'Description',
        })
      })

      expect(scriptApi.create).toHaveBeenCalledWith({
        name: 'New Script',
        description: 'Description',
      })
      expect(createdScript).toEqual(mockScript)
    })

    it('should handle create error', async () => {
      const error = new Error('Create failed')
      vi.mocked(scriptApi.create).mockRejectedValue(error)

      const { result } = renderHook(() => useScripts())

      await expect(
        act(async () => {
          await result.current.createScript({ name: 'Test' })
        })
      ).rejects.toThrow('Create failed')
    })
  })

  describe('updateScript', () => {
    it('should update script successfully', async () => {
      const updatedScript = { ...mockScript, name: 'Updated Script' }
      vi.mocked(scriptApi.update).mockResolvedValue(updatedScript)

      const { result } = renderHook(() => useScripts())

      let returnedScript: Script | undefined
      await act(async () => {
        returnedScript = await result.current.updateScript('script-1', { name: 'Updated Script' })
      })

      expect(scriptApi.update).toHaveBeenCalledWith('script-1', { name: 'Updated Script' })
      expect(returnedScript).toEqual(updatedScript)
    })

    it('should handle update error', async () => {
      const error = new Error('Update failed')
      vi.mocked(scriptApi.update).mockRejectedValue(error)

      const { result } = renderHook(() => useScripts())

      await expect(
        act(async () => {
          await result.current.updateScript('script-1', { name: 'Test' })
        })
      ).rejects.toThrow('Update failed')
    })
  })

  describe('deleteScript', () => {
    it('should delete script successfully', async () => {
      vi.mocked(scriptApi.delete).mockResolvedValue(undefined)

      const { result } = renderHook(() => useScripts())

      await act(async () => {
        await result.current.deleteScript('script-1')
      })

      expect(scriptApi.delete).toHaveBeenCalledWith('script-1')
    })

    it('should handle delete error', async () => {
      const error = new Error('Delete failed')
      vi.mocked(scriptApi.delete).mockRejectedValue(error)

      const { result } = renderHook(() => useScripts())

      await expect(
        act(async () => {
          await result.current.deleteScript('script-1')
        })
      ).rejects.toThrow('Delete failed')
    })
  })

  describe('copyScript', () => {
    it('should copy script successfully', async () => {
      const copiedScript = { ...mockScript, id: 'script-2', name: 'Test Script (Copy)' }
      vi.mocked(scriptApi.copy).mockResolvedValue(copiedScript)

      const { result } = renderHook(() => useScripts())

      let returnedScript: Script | undefined
      await act(async () => {
        returnedScript = await result.current.copyScript('script-1')
      })

      expect(scriptApi.copy).toHaveBeenCalledWith('script-1')
      expect(returnedScript).toEqual(copiedScript)
    })

    it('should handle copy error', async () => {
      const error = new Error('Copy failed')
      vi.mocked(scriptApi.copy).mockRejectedValue(error)

      const { result } = renderHook(() => useScripts())

      await expect(
        act(async () => {
          await result.current.copyScript('script-1')
        })
      ).rejects.toThrow('Copy failed')
    })
  })
})
