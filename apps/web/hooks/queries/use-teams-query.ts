import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsService, Team } from '@/services/teams.service';
import { teamKeys } from './keys';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { useWorkspaces } from './use-workspaces-query';

export function useTeams(workspaceId?: string) {
   const { orgId } = useParams<{ orgId?: string }>();
   const { data: workspaces = [], isFetched: workspacesFetched } = useWorkspaces();
   const resolvedWorkspaceId =
      workspaceId ||
      workspaces.find((workspace) => workspace.slug === orgId || workspace.id === orgId)?.id;
   const hasRouteWorkspace = Boolean(workspaceId || orgId);
   return useQuery({
      queryKey: teamKeys.list(resolvedWorkspaceId),
      queryFn: () => teamsService.getTeams(resolvedWorkspaceId),
      enabled: !hasRouteWorkspace || (workspacesFetched && Boolean(resolvedWorkspaceId)),
   });
}

export function useTeam(id: string, enabled = true) {
   return useQuery({
      queryKey: teamKeys.detail(id),
      queryFn: () => teamsService.getTeamById(id),
      enabled: Boolean(id) && enabled,
   });
}

export function useCreateTeam() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: (data: Partial<Team>) => teamsService.createTeam(data),
      onSuccess: (newTeam) => {
         queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
         toast.success(`Team "${newTeam.name}" created`);
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to create team');
      },
   });
}

export function useUpdateTeam() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<Team> }) =>
         teamsService.updateTeam(id, data),
      onSuccess: (updated) => {
         queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
         queryClient.invalidateQueries({ queryKey: teamKeys.detail(updated.id) });
         toast.success('Team settings saved');
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to update team');
      },
   });
}

export function useToggleJoinTeam() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: (id: string) => teamsService.toggleJoinTeam(id),
      onSuccess: async (updated) => {
         await Promise.all([
            queryClient.invalidateQueries({ queryKey: teamKeys.lists() }),
            queryClient.invalidateQueries({ queryKey: teamKeys.detail(updated.id) }),
         ]);
      },
   });
}

export function useDeleteTeam() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: (id: string) => teamsService.deleteTeam(id),
      onSuccess: (_, id) => {
         queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
         queryClient.removeQueries({ queryKey: teamKeys.detail(id) });
         toast.success('Team deleted');
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to delete team');
      },
   });
}

export function useAddTeamMember() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ teamId, memberId }: { teamId: string; memberId: string }) =>
         teamsService.addTeamMember(teamId, memberId),
      onSuccess: (updated) => {
         queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
         queryClient.invalidateQueries({ queryKey: teamKeys.detail(updated.id) });
         toast.success('Member added');
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to add member');
      },
   });
}

export function useRemoveTeamMember() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ teamId, memberId }: { teamId: string; memberId: string }) =>
         teamsService.removeTeamMember(teamId, memberId),
      onSuccess: (updated) => {
         queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
         queryClient.invalidateQueries({ queryKey: teamKeys.detail(updated.id) });
         toast.success('Member removed');
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to remove member');
      },
   });
}
