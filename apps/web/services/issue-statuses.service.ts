import { apiClient } from './api-client';

export type IssueStatusCategory =
   | 'triage'
   | 'backlog'
   | 'unstarted'
   | 'started'
   | 'completed'
   | 'canceled';

export interface IssueStatusRecord {
   id: string;
   teamId?: string;
   name: string;
   description?: string;
   color: string;
   category: IssueStatusCategory;
   position: number;
   isDefault: boolean;
   isSystem: boolean;
   createdAt?: string;
   updatedAt?: string;
}

export interface CreateIssueStatusPayload {
   name: string;
   description?: string;
   color: string;
   category: IssueStatusCategory;
}

export type UpdateIssueStatusPayload = Partial<
   Pick<CreateIssueStatusPayload, 'name' | 'description' | 'color'>
>;

const route = (teamId: string) => `/circle/api/teams/${teamId}/issue-statuses`;

export const issueStatusesService = {
   list(teamId: string) {
      return apiClient<IssueStatusRecord[]>(route(teamId));
   },
   create(teamId: string, payload: CreateIssueStatusPayload) {
      return apiClient<IssueStatusRecord>(route(teamId), {
         method: 'POST',
         body: JSON.stringify(payload),
      });
   },
   update(teamId: string, statusId: string, payload: UpdateIssueStatusPayload) {
      return apiClient<IssueStatusRecord>(`${route(teamId)}/${statusId}`, {
         method: 'PATCH',
         body: JSON.stringify(payload),
      });
   },
   remove(teamId: string, statusId: string) {
      return apiClient<{ success: boolean; id: string }>(`${route(teamId)}/${statusId}`, {
         method: 'DELETE',
      });
   },
   reorder(teamId: string, category: IssueStatusCategory, statusIds: string[]) {
      return apiClient<IssueStatusRecord[]>(`${route(teamId)}/order`, {
         method: 'PATCH',
         body: JSON.stringify({ category, statusIds }),
      });
   },
};
