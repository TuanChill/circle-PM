import { apiClient } from './api-client';

export interface LarkMemberMapping {
   id: string;
   name: string;
   email: string;
   openId: string;
}

export interface LarkIntegrationSettings {
   configured: boolean;
   enabled: boolean;
   appId: string;
   domain: string;
   groupChatId: string;
   appSecretConfigured: boolean;
   members: LarkMemberMapping[];
   pendingDeliveries: number;
   needsConfiguration: number;
   failedDeliveries: number;
}

export interface UpdateLarkIntegrationPayload {
   appId: string;
   appSecret?: string;
   domain: string;
   groupChatId: string;
   enabled: boolean;
   memberMappings: Array<{ memberId: string; openId: string }>;
}

export const larkIntegrationService = {
   get(workspaceId: string) {
      return apiClient<LarkIntegrationSettings>(
         `/circle/api/workspaces/${workspaceId}/lark-integration`
      );
   },

   update(workspaceId: string, payload: UpdateLarkIntegrationPayload) {
      return apiClient<LarkIntegrationSettings>(
         `/circle/api/workspaces/${workspaceId}/lark-integration`,
         { method: 'PUT', body: JSON.stringify(payload) }
      );
   },
};
