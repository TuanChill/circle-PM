import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
   issuesService,
   IssueFacetParams,
   IssueFilterParams,
   CreateIssuePayload,
   UpdateIssuePayload,
} from '@/services/issues.service';
import type { ContentBlock, IssueDetail } from '@/mock-data/issue-details';
import { issueKeys } from './keys';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { useWorkspaces } from './use-workspaces-query';

export function useIssues(params?: IssueFilterParams) {
   const { orgId } = useParams<{ orgId?: string }>();
   const { data: workspaces = [], isFetched: workspacesFetched } = useWorkspaces();
   const workspaceId =
      params?.workspaceId ||
      workspaces.find((workspace) => workspace.slug === orgId || workspace.id === orgId)?.id;
   const hasRouteWorkspace = Boolean(params?.workspaceId || orgId);
   const scopedParams = { ...params, workspaceId };
   return useQuery({
      queryKey: issueKeys.list(scopedParams as Record<string, unknown>),
      queryFn: () => issuesService.getIssues(scopedParams),
      enabled: !hasRouteWorkspace || (workspacesFetched && Boolean(workspaceId)),
   });
}

export function useArchivedIssues(teamId?: string) {
   return useQuery({
      queryKey: issueKeys.archived(teamId),
      queryFn: () => issuesService.getArchivedIssues(teamId),
      enabled: Boolean(teamId),
   });
}

export function useIssueFacets(params?: IssueFacetParams) {
   const { orgId } = useParams<{ orgId?: string }>();
   const { data: workspaces = [], isFetched: workspacesFetched } = useWorkspaces();
   const workspaceId =
      params?.workspaceId ||
      workspaces.find((workspace) => workspace.slug === orgId || workspace.id === orgId)?.id;
   const hasRouteWorkspace = Boolean(params?.workspaceId || orgId);
   const scopedParams = { ...params, workspaceId };

   const query = useQuery({
      queryKey: issueKeys.facets(scopedParams as Record<string, unknown>),
      queryFn: () => issuesService.getIssueFacets(scopedParams),
      enabled: !hasRouteWorkspace || (workspacesFetched && Boolean(workspaceId)),
      staleTime: 30_000,
   });

   useEffect(() => {
      if (query.error) {
         toast.error(`Could not load issue filter counts: ${query.error.message}`);
      }
   }, [query.error]);

   return query;
}

export function useIssue(identifier: string, enabled = true) {
   const { orgId } = useParams<{ orgId?: string }>();
   const { data: workspaces = [], isFetched: workspacesFetched } = useWorkspaces();
   const workspaceId = workspaces.find(
      (workspace) => workspace.slug === orgId || workspace.id === orgId
   )?.id;
   return useQuery({
      queryKey: [...issueKeys.detail(identifier), workspaceId],
      queryFn: () => issuesService.getIssueById(identifier, workspaceId),
      enabled:
         Boolean(identifier) && enabled && (!orgId || (workspacesFetched && Boolean(workspaceId))),
   });
}

export function useIssueDetail(identifier: string, enabled = true) {
   const { orgId } = useParams<{ orgId?: string }>();
   const { data: workspaces = [], isFetched: workspacesFetched } = useWorkspaces();
   const workspaceId = workspaces.find(
      (workspace) => workspace.slug === orgId || workspace.id === orgId
   )?.id;
   return useQuery({
      queryKey: [...issueKeys.activity(identifier), workspaceId],
      queryFn: () => issuesService.getIssueDetail(identifier, workspaceId),
      enabled:
         Boolean(identifier) && enabled && (!orgId || (workspacesFetched && Boolean(workspaceId))),
   });
}

export function useCreateIssue() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: (data: CreateIssuePayload) => issuesService.createIssue(data),
      onSuccess: (newIssue) => {
         queryClient.invalidateQueries({ queryKey: issueKeys.all });
         queryClient.invalidateQueries({ queryKey: ['issues'] });
         queryClient.invalidateQueries({ queryKey: ['projects'] });
         toast.success(`Created issue ${newIssue.identifier || newIssue.title}`);
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to create issue');
      },
   });
}

export function useUpdateIssue() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ identifier, data }: { identifier: string; data: UpdateIssuePayload }) =>
         issuesService.updateIssue(identifier, data),
      onSuccess: (updated) => {
         queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
         queryClient.invalidateQueries({ queryKey: issueKeys.detail(updated.identifier) });
         queryClient.invalidateQueries({ queryKey: issueKeys.activity(updated.identifier) });
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to update issue');
      },
   });
}

export function useDeleteIssue() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: (identifier: string) => issuesService.deleteIssue(identifier),
      onSuccess: (_, identifier) => {
         queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
         queryClient.removeQueries({ queryKey: issueKeys.detail(identifier) });
         toast.success(`Deleted issue ${identifier}`);
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to delete issue');
      },
   });
}

export function useRestoreIssue() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: (identifier: string) => issuesService.restoreIssue(identifier),
      onSuccess: (restored) => {
         queryClient.invalidateQueries({ queryKey: issueKeys.all });
         queryClient.invalidateQueries({ queryKey: issueKeys.detail(restored.identifier) });
         toast.success(`Restored issue ${restored.identifier}`);
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to restore issue');
      },
   });
}

export function useToggleIssueSubscription() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ identifier, subscribed }: { identifier: string; subscribed: boolean }) =>
         subscribed ? issuesService.subscribe(identifier) : issuesService.unsubscribe(identifier),
      onSuccess: (result) => {
         queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
         queryClient.invalidateQueries({ queryKey: issueKeys.detail(result.identifier) });
         toast.success(result.subscribed ? 'Subscribed to issue' : 'Unsubscribed from issue');
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Could not update issue subscription');
      },
   });
}

export function useAddIssueComment() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({
         identifier,
         actorId,
         textContent,
         commentBlocks,
         attachmentIds,
      }: {
         identifier: string;
         actorId: string;
         textContent?: string;
         commentBlocks?: ContentBlock[];
         attachmentIds?: string[];
      }) =>
         issuesService.addComment(identifier, {
            actorId,
            textContent,
            commentBlocks,
            attachmentIds,
         }),
      onSuccess: (updatedDetail, { identifier }) => {
         queryClient.setQueryData(issueKeys.activity(identifier), updatedDetail);
         queryClient.invalidateQueries({ queryKey: issueKeys.activity(identifier) });
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to post comment');
      },
   });
}

export function useAddIssueReaction() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({
         activityId,
         emoji,
         userId,
         issueIdentifier,
      }: {
         activityId: string;
         emoji: string;
         userId?: string;
         issueIdentifier?: string;
      }) => issuesService.addReaction(activityId, emoji, userId),
      onSuccess: (_, variables) => {
         if (variables.issueIdentifier) {
            queryClient.invalidateQueries({
               queryKey: issueKeys.activity(variables.issueIdentifier),
            });
         }
      },
   });
}

export function useAddIssueRelation() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({
         identifier,
         targetIdentifier,
         relationType,
      }: {
         identifier: string;
         targetIdentifier: string;
         relationType: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate_of';
      }) => issuesService.addRelation(identifier, targetIdentifier, relationType),
      onSuccess: (updatedDetail, { identifier }) => {
         queryClient.setQueryData(issueKeys.activity(identifier), updatedDetail);
         queryClient.invalidateQueries({ queryKey: issueKeys.activity(identifier) });
         toast.success('Relation added');
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to add relation');
      },
   });
}

export function useDeleteIssueRelation() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ identifier, relationId }: { identifier: string; relationId: string }) =>
         issuesService.deleteRelation(identifier, relationId),
      onSuccess: (updatedDetail, { identifier }) => {
         queryClient.setQueryData(issueKeys.activity(identifier), updatedDetail);
         queryClient.invalidateQueries({ queryKey: issueKeys.activity(identifier) });
         toast.success('Relation removed');
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to remove relation');
      },
   });
}
