import { apiClient } from './api-client';

export type ProjectStatusCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export interface ProjectStatusRecord {
   id: string;
   workspaceId: string;
   name: string;
   description?: string;
   color: string;
   category: ProjectStatusCategory;
   position: number;
   createdAt: string;
   updatedAt: string;
}

export interface CreateProjectStatusPayload {
   name: string;
   description?: string;
   color: string;
   category: ProjectStatusCategory;
}

export const projectStatusesService = {
   list(workspaceId: string) {
      return apiClient<ProjectStatusRecord[]>(
         `/circle/api/workspaces/${workspaceId}/project-statuses`
      );
   },
   create(workspaceId: string, payload: CreateProjectStatusPayload) {
      return apiClient<ProjectStatusRecord>(
         `/circle/api/workspaces/${workspaceId}/project-statuses`,
         {
            method: 'POST',
            body: JSON.stringify(payload),
         }
      );
   },
};
