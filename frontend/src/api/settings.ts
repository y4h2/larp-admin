import client from './client';
import type { User, AuditLog, GlobalSettings, PaginatedResponse } from '@/types';

export interface UserQueryParams {
  page?: number;
  page_size?: number;
  role?: User['role'];
  status?: User['status'];
  search?: string;
}

export interface AuditLogQueryParams {
  page?: number;
  page_size?: number;
  user_id?: string;
  resource_type?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
}

// Global Settings API
export const settingsApi = {
  get: async (): Promise<GlobalSettings> => {
    const response = await client.get('/settings');
    return response.data;
  },

  update: async (data: Partial<GlobalSettings>): Promise<GlobalSettings> => {
    const response = await client.put('/settings', data);
    return response.data;
  },
};

// Users API
export const userApi = {
  list: async (params: UserQueryParams = {}): Promise<PaginatedResponse<User>> => {
    const response = await client.get('/users', { params });
    return response.data;
  },

  get: async (id: string): Promise<User> => {
    const response = await client.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: Partial<User> & { password: string }): Promise<User> => {
    const response = await client.post('/users', data);
    return response.data;
  },

  update: async (id: string, data: Partial<User>): Promise<User> => {
    const response = await client.put(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/users/${id}`);
  },

  resetPassword: async (id: string, newPassword: string): Promise<void> => {
    await client.post(`/users/${id}/reset-password`, { password: newPassword });
  },
};

// Audit Logs API
export const auditLogApi = {
  list: async (params: AuditLogQueryParams = {}): Promise<PaginatedResponse<AuditLog>> => {
    const response = await client.get('/audit-logs', { params });
    return response.data;
  },

  get: async (id: string): Promise<AuditLog> => {
    const response = await client.get(`/audit-logs/${id}`);
    return response.data;
  },
};
