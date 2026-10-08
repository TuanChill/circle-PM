import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
   issueStatusesService,
   CreateIssueStatusPayload,
   UpdateIssueStatusPayload,
   IssueStatusCategory,
} from '@/services/issue-statuses.service';
import { issueKeys, issueStatusKeys } from './keys';

export function useIssueStatuses(teamId?: string) {
   return useQuery({
      queryKey: issueStatusKeys.list(teamId),
      queryFn: () => issueStatusesService.list(teamId!),
      enabled: Boolean(teamId),
   });
}

function useIssueStatusMutation<TVariables>(
   mutationFn: (variables: TVariables) => Promise<unknown>,
   teamIdOf: (variables: TVariables) => string
) {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn,
      onSuccess: async (_result, variables) => {
         const teamId = teamIdOf(variables);
         await Promise.all([
            queryClient.invalidateQueries({ queryKey: issueStatusKeys.list(teamId) }),
            queryClient.invalidateQueries({ queryKey: issueKeys.all }),
         ]);
      },
   });
}

export function useCreateIssueStatus() {
   return useIssueStatusMutation(
      ({ teamId, payload }: { teamId: string; payload: CreateIssueStatusPayload }) =>
         issueStatusesService.create(teamId, payload),
      ({ teamId }) => teamId
   );
}

export function useUpdateIssueStatus() {
   return useIssueStatusMutation(
      ({
         teamId,
         statusId,
         payload,
      }: {
         teamId: string;
         statusId: string;
         payload: UpdateIssueStatusPayload;
      }) => issueStatusesService.update(teamId, statusId, payload),
      ({ teamId }) => teamId
   );
}

export function useDeleteIssueStatus() {
   return useIssueStatusMutation(
      ({ teamId, statusId }: { teamId: string; statusId: string }) =>
         issueStatusesService.remove(teamId, statusId),
      ({ teamId }) => teamId
   );
}

export function useReorderIssueStatuses() {
   return useIssueStatusMutation(
      ({
         teamId,
         category,
         statusIds,
      }: {
         teamId: string;
         category: IssueStatusCategory;
         statusIds: string[];
      }) => issueStatusesService.reorder(teamId, category, statusIds),
      ({ teamId }) => teamId
   );
}
