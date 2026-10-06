import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { projectStatusKeys, projectKeys, projectTemplateKeys } from './keys';
import { useWorkspaces } from './use-workspaces-query';
import {
   CreateProjectStatusPayload,
   projectStatusesService,
} from '@/services/project-statuses.service';

export function useProjectStatuses(workspaceId?: string) {
   const { orgId } = useParams<{ orgId?: string }>();
   const { data: workspaces = [], isFetched: workspacesFetched } = useWorkspaces();
   const requestedWorkspace = workspaceId || orgId;
   const resolvedWorkspaceId = workspaces.find(
      (workspace) => workspace.slug === requestedWorkspace || workspace.id === requestedWorkspace
   )?.id;
   const hasRouteWorkspace = Boolean(workspaceId || orgId);
   const query = useQuery({
      queryKey: projectStatusKeys.list(resolvedWorkspaceId),
      queryFn: () => projectStatusesService.list(resolvedWorkspaceId!),
      enabled: Boolean(resolvedWorkspaceId) && (!hasRouteWorkspace || workspacesFetched),
   });
   return { ...query, workspaceId: resolvedWorkspaceId };
}

export function useCreateProjectStatus() {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: ({
         workspaceId,
         payload,
      }: {
         workspaceId: string;
         payload: CreateProjectStatusPayload;
      }) => projectStatusesService.create(workspaceId, payload),
      onSuccess: (_, { workspaceId }) => {
         queryClient.invalidateQueries({ queryKey: projectStatusKeys.list(workspaceId) });
         queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
         queryClient.invalidateQueries({ queryKey: projectTemplateKeys.lists() });
      },
   });
}
