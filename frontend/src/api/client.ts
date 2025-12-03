import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import type { ApiResponse } from '@/types';

const API_BASE_URL = '/api';

// Generate UUID v4 for request tracking
function generateRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Store the last request ID for error display
let lastRequestId: string | null = null;

export function getLastRequestId(): string | null {
  return lastRequestId;
}

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Generate and add request ID for tracking
    const requestId = generateRequestId();
    config.headers['X-Request-ID'] = requestId;

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor
client.interceptors.response.use(
  (response: AxiosResponse) => {
    // Store request ID from response
    const requestId = response.headers['x-request-id'];
    if (requestId) {
      lastRequestId = requestId;
    }
    return response;
  },
  (error: AxiosError<ApiResponse<unknown>>) => {
    // Store request ID from error response
    if (error.response?.headers) {
      const requestId = error.response.headers['x-request-id'];
      if (requestId) {
        lastRequestId = requestId;
      }
    }

    if (error.response) {
      const { status, data } = error.response;
      const requestId = error.response.headers['x-request-id'];

      if (status === 401) {
        // Handle unauthorized
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      } else if (status === 403) {
        console.error(`[${requestId}] Permission denied`);
      } else if (status >= 500) {
        console.error(`[${requestId}] Server error:`, data?.message || 'Unknown error');
      }
    } else if (error.request) {
      console.error('Network error');
    }

    return Promise.reject(error);
  }
);

export default client;
