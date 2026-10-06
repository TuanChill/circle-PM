import { apiClient } from './api-client';
import type { Issue } from '@/mock-data/issues';
import type { ContentBlock, IssueDetail } from '@/mock-data/issue-details';
import type { ArchivedIssue } from '@/lib/api/issues';

export interface IssueFilterParams {
   workspaceId?: string;
   teamId?: string;
   cycleId?: string;
   projectId?: string;
   statusCategories?: string[];
   statusIds?: string[];
   priorityIds?: string[];
   assigneeId?: string;
   labelIds?: string[];
   search?: string;
   /** Serialized saved-view conditions evaluated by the scoped API. */
   advancedFilters?: string;
}

export type IssueFacetParams = Pick<
   IssueFilterParams,
   'workspaceId' | 'teamId' | 'cycleId' | 'projectId'
>;

export interface IssueFacetCounts {
   status: Record<string, number>;
   statusType: Record<string, number>;
   priority: Record<string, number>;
   assignee: Record<string, number>;
   labels: Record<string, number>;
   project: Record<string, number>;
   cycle: Record<string, number>;
}

export interface CreateIssuePayload {
   identifier?: string;
   title: string;
   description?: string;
   descriptionBlocks?: ContentBlock[];
   statusId?: string;
   statusCategory?: string;
   priorityId?: string;
   estimate?: number | null;
   assigneeId?: string;
   creatorId?: string;
   teamId?: string;
   projectId?: string;
   cycleId?: string;
   parentIssueId?: string;
   labelIds?: string[];
   rank?: string;
   dueDate?: string;
   milestone?: string;
}

export interface UpdateIssuePayload {
   title?: string;
   description?: string;
   descriptionBlocks?: ContentBlock[];
   statusId?: string;
   statusCategory?: string;
   priorityId?: string;
   estimate?: number | null;
   assigneeId?: string | null;
   teamId?: string;
   projectId?: string;
   cycleId?: string;
   parentIssueId?: string;
   labelIds?: string[];
   rank?: string;
   dueDate?: string;
   milestone?: string;
}

export const issuesService = {
   async getIssues(params?: IssueFilterParams): Promise<Issue[]> {
      return apiClient<Issue[]>('/issues', {
         params: params as Record<string, string | string[] | undefined>,
      });
   },

   async getArchivedIssues(teamId?: string): Promise<ArchivedIssue[]> {
      return apiClient<ArchivedIssue[]>('/issues/archived', {
         params: teamId ? { teamId } : undefined,
      });
   },

   async getIssueFacets(params?: IssueFacetParams): Promise<IssueFacetCounts> {
      return apiClient<IssueFacetCounts>('/issues/facets', {
         params: params as Record<string, string | string[] | undefined>,
      });
   },

   async getIssueById(identifier: string, workspaceId?: string): Promise<Issue> {
      return apiClient<Issue>(`/issues/${identifier}`, { params: { workspaceId } });
   },

   async getIssueDetail(identifier: string, workspaceId?: string): Promise<IssueDetail> {
      return apiClient<IssueDetail>(`/issues/${identifier}/detail`, {
         params: { workspaceId },
      });
   },

   async createIssue(data: CreateIssuePayload): Promise<Issue> {
      return apiClient<Issue>('/issues', {
         method: 'POST',
         body: JSON.stringify(data),
      });
   },

   async updateIssue(identifier: string, data: UpdateIssuePayload): Promise<Issue> {
      return apiClient<Issue>(`/issues/${identifier}`, {
         method: 'PATCH',
         body: JSON.stringify(data),
      });
   },

   async updateIssueRank(identifier: string, rank: string): Promise<{ success: boolean }> {
      return apiClient<{ success: boolean }>(`/issues/${identifier}/rank`, {
         method: 'PATCH',
         body: JSON.stringify({ rank }),
      });
   },

   async deleteIssue(identifier: string): Promise<{ success: boolean }> {
      return apiClient<{ success: boolean }>(`/issues/${identifier}`, {
         method: 'DELETE',
      });
   },

   async restoreIssue(identifier: string): Promise<Issue> {
      return apiClient<Issue>(`/issues/${identifier}/restore`, { method: 'POST' });
   },

   async getSubscription(identifier: string): Promise<{ identifier: string; subscribed: boolean }> {
      return apiClient<{ identifier: string; subscribed: boolean }>(
         `/issues/${identifier}/subscription`
      );
   },

   async subscribe(identifier: string): Promise<{ identifier: string; subscribed: boolean }> {
      return apiClient<{ identifier: string; subscribed: boolean }>(
         `/issues/${identifier}/subscription`,
         { method: 'POST' }
      );
   },

   async unsubscribe(identifier: string): Promise<{ identifier: string; subscribed: boolean }> {
      return apiClient<{ identifier: string; subscribed: boolean }>(
         `/issues/${identifier}/subscription`,
         { method: 'DELETE' }
      );
   },

   async addComment(
      identifier: string,
      data: {
         actorId: string;
         textContent?: string;
         commentBlocks?: ContentBlock[];
         attachmentIds?: string[];
      }
   ): Promise<IssueDetail> {
      return apiClient<IssueDetail>(`/issues/${identifier}/comments`, {
         method: 'POST',
         body: JSON.stringify(data),
      });
   },

   async addReaction(
      commentId: string,
      emoji: string,
      userId?: string
   ): Promise<{
      id: string;
      reactions: Array<{ emoji: string; count: number; userIds: string[] }>;
   }> {
      return apiClient<{
         id: string;
         reactions: Array<{ emoji: string; count: number; userIds: string[] }>;
      }>(`/issues/comments/${commentId}/reactions`, {
         method: 'POST',
         body: JSON.stringify({ emoji, userId }),
      });
   },

   async removeReaction(
      commentId: string,
      emoji: string
   ): Promise<{
      id: string;
      reactions: Array<{ emoji: string; count: number; userIds: string[] }>;
   }> {
      return apiClient<{
         id: string;
         reactions: Array<{ emoji: string; count: number; userIds: string[] }>;
      }>(`/issues/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`, {
         method: 'DELETE',
      });
   },

   async addRelation(
      identifier: string,
      targetIdentifier: string,
      relationType: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate_of'
   ): Promise<IssueDetail> {
      return apiClient<IssueDetail>(`/issues/${identifier}/relations`, {
         method: 'POST',
         body: JSON.stringify({ targetIdentifier, relationType }),
      });
   },

   async deleteRelation(identifier: string, relationId: string): Promise<IssueDetail> {
      return apiClient<IssueDetail>(`/issues/${identifier}/relations/${relationId}`, {
         method: 'DELETE',
      });
   },
};
