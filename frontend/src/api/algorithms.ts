import client from './client';
import type { AlgorithmImplementation, AlgorithmStrategy, PaginatedResponse } from '@/types';

export interface StrategyQueryParams {
  page?: number;
  page_size?: number;
  impl_id?: string;
  scope_type?: AlgorithmStrategy['scope_type'];
  status?: AlgorithmStrategy['status'];
  search?: string;
}

export const algorithmApi = {
  // Algorithm Implementations (read-only)
  listImplementations: async (): Promise<AlgorithmImplementation[]> => {
    const response = await client.get('/algorithms');
    return response.data;
  },

  getImplementation: async (id: string): Promise<AlgorithmImplementation> => {
    const response = await client.get(`/algorithms/${id}`);
    return response.data;
  },
};

export const strategyApi = {
  list: async (params: StrategyQueryParams = {}): Promise<PaginatedResponse<AlgorithmStrategy>> => {
    const response = await client.get('/strategies', { params });
    return response.data;
  },

  get: async (id: string): Promise<AlgorithmStrategy> => {
    const response = await client.get(`/strategies/${id}`);
    return response.data;
  },

  create: async (data: Partial<AlgorithmStrategy>): Promise<AlgorithmStrategy> => {
    const response = await client.post('/strategies', data);
    return response.data;
  },

  update: async (id: string, data: Partial<AlgorithmStrategy>): Promise<AlgorithmStrategy> => {
    const response = await client.put(`/strategies/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/strategies/${id}`);
  },

  setDefault: async (id: string): Promise<AlgorithmStrategy> => {
    const response = await client.post(`/strategies/${id}/set-default`);
    return response.data;
  },
};
