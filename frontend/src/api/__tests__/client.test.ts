import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

// Mock axios before importing client
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    interceptors: {
      request: {
        use: vi.fn(),
      },
      response: {
        use: vi.fn(),
      },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
  return { default: mockAxios }
})

describe('API Client', () => {
  let mockAxiosInstance: AxiosInstance
  let requestInterceptor: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
  let requestErrorHandler: (error: Error) => Promise<never>
  let responseInterceptor: (response: AxiosResponse) => AxiosResponse
  let responseErrorHandler: (error: Error & { response?: { status: number; data?: { message?: string } }; request?: object }) => Promise<never>

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset modules to get fresh client
    vi.resetModules()

    // Setup mock
    mockAxiosInstance = axios as unknown as AxiosInstance

    // Capture interceptors when they're registered
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance)
    vi.mocked(mockAxiosInstance.interceptors.request.use).mockImplementation((onFulfilled, onRejected) => {
      requestInterceptor = onFulfilled as (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
      requestErrorHandler = onRejected as (error: Error) => Promise<never>
      return 0
    })
    vi.mocked(mockAxiosInstance.interceptors.response.use).mockImplementation((onFulfilled, onRejected) => {
      responseInterceptor = onFulfilled as (response: AxiosResponse) => AxiosResponse
      responseErrorHandler = onRejected as (error: Error & { response?: { status: number; data?: { message?: string } }; request?: object }) => Promise<never>
      return 0
    })

    // Import client to trigger interceptor registration
    await import('../client')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  describe('axios instance creation', () => {
    it('should create axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: '/api',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    })
  })

  describe('request interceptor', () => {
    it('should add auth token to headers when available', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('test-token')

      const config = {
        headers: {},
      } as InternalAxiosRequestConfig

      const result = requestInterceptor(config)

      expect(localStorage.getItem).toHaveBeenCalledWith('auth_token')
      expect(result.headers.Authorization).toBe('Bearer test-token')
    })

    it('should not add auth header when no token', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)

      const config = {
        headers: {},
      } as InternalAxiosRequestConfig

      const result = requestInterceptor(config)

      expect(result.headers.Authorization).toBeUndefined()
    })

    it('should reject on request error', async () => {
      const error = new Error('Request setup failed')

      await expect(requestErrorHandler(error)).rejects.toThrow('Request setup failed')
    })
  })

  describe('response interceptor', () => {
    it('should pass through successful responses', () => {
      const response = {
        data: { success: true },
        status: 200,
      } as AxiosResponse

      const result = responseInterceptor(response)

      expect(result).toBe(response)
    })

    it('should handle 401 unauthorized error', async () => {
      const originalLocation = window.location
      // @ts-expect-error - mocking window.location
      delete window.location
      window.location = { href: '' } as Location

      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
        message: 'Unauthorized',
      }

      await expect(responseErrorHandler(error as Error & { response: { status: number; data: { message: string } } })).rejects.toEqual(error)

      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token')
      expect(window.location.href).toBe('/login')

      window.location = originalLocation
    })

    it('should handle 403 forbidden error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const error = {
        response: {
          status: 403,
          data: {},
        },
        message: 'Forbidden',
      }

      await expect(responseErrorHandler(error as Error & { response: { status: number; data: object } })).rejects.toEqual(error)

      expect(consoleSpy).toHaveBeenCalledWith('Permission denied')
    })

    it('should handle 500+ server errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const error = {
        response: {
          status: 500,
          data: { message: 'Internal Server Error' },
        },
        message: 'Server Error',
      }

      await expect(responseErrorHandler(error as Error & { response: { status: number; data: { message: string } } })).rejects.toEqual(error)

      expect(consoleSpy).toHaveBeenCalledWith('Server error:', 'Internal Server Error')
    })

    it('should handle network error (no response)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const error = {
        request: {},
        message: 'Network Error',
      }

      await expect(responseErrorHandler(error as Error & { request: object })).rejects.toEqual(error)

      expect(consoleSpy).toHaveBeenCalledWith('Network error')
    })
  })
})
