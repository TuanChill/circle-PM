import { apiClient } from './api-client';

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface HeartbeatPayload {
   workspaceId: string;
   status: 'online' | 'away';
}

export const presenceService = {
   async sendHeartbeat(workspaceId: string, status: 'online' | 'away'): Promise<void> {
      return apiClient('/presence/heartbeat', {
         method: 'POST',
         body: JSON.stringify({ workspaceId, status }),
      });
   },

   async getWorkspacePresence(workspaceId: string): Promise<Record<string, PresenceStatus>> {
      const res = await apiClient<{ presence: Record<string, PresenceStatus> }>(
         `/presence/workspace/${workspaceId}`
      );
      return res?.presence ?? {};
   },
};
