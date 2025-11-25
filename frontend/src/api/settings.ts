import client from './client';
import type { GlobalSettings } from '@/types';

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
