import { apiClient } from './client';
import type { Cycle } from '@/services/cycles.service';

export type { Cycle };

export async function getCycles(teamId?: string): Promise<Cycle[]> {
   const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
   return apiClient<Cycle[]>(`/circle/api/cycles${query}`);
}

export async function getCycleById(id: string): Promise<Cycle> {
   return apiClient<Cycle>(`/circle/api/cycles/${id}`);
}

export async function updateCycle(id: string, payload: Partial<Cycle>): Promise<Cycle> {
   return apiClient<Cycle>(`/circle/api/cycles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
   });
}
