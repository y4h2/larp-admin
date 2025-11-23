import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types';

const API_BASE_URL = '/api';

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
  (response) => {
    return response;
  },
  (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.response) {
      const { status, data } = error.response;

      if (status === 401) {
        // Handle unauthorized
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      } else if (status === 403) {
        console.error('Permission denied');
      } else if (status >= 500) {
        console.error('Server error:', data?.message || 'Unknown error');
      }
    } else if (error.request) {
      console.error('Network error');
    }

    return Promise.reject(error);
  }
);

export default client;
