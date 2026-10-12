import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
   cyclesService,
   Cycle,
   CycleCalendarSubscription,
   CycleSettings,
} from '@/services/cycles.service';
import { cycleKeys } from './keys';
import { toast } from 'sonner';

export function useCycles(teamId?: string, options?: { requireTeamId?: boolean }) {
   return useQuery({
      queryKey: cycleKeys.list(teamId),
      queryFn: () => cyclesService.getCycles(teamId),
      enabled: !options?.requireTeamId || Boolean(teamId),
   });
}

export function useCycle(id: string, enabled = true) {
   return useQuery({
      queryKey: cycleKeys.detail(id),
      queryFn: () => cyclesService.getCycleById(id),
      enabled: Boolean(id) && enabled,
   });
}

export function useCycleSettings(teamId: string, enabled = true) {
   return useQuery({
      queryKey: cycleKeys.settings(teamId),
      queryFn: () => cyclesService.getCycleSettings(teamId),
      enabled: Boolean(teamId) && enabled,
   });
}

export function useUpdateCycleSettings() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({
         teamId,
         payload,
      }: {
         teamId: string;
         payload: Partial<Omit<CycleSettings, 'teamId'>>;
      }) => cyclesService.updateCycleSettings(teamId, payload),
      onSuccess: (_data, { teamId }) => {
         queryClient.invalidateQueries({ queryKey: cycleKeys.settings(teamId) });
         queryClient.invalidateQueries({ queryKey: cycleKeys.list(teamId) });
         queryClient.invalidateQueries({ queryKey: cycleKeys.lists() });
         toast.success('Cycle settings updated');
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to update cycle settings');
      },
   });
}

export function useCycleCalendarSubscription(teamId: string, enabled = true) {
   return useQuery({
      queryKey: cycleKeys.calendarSubscription(teamId),
      queryFn: () => cyclesService.getCalendarSubscription(teamId),
      enabled: Boolean(teamId) && enabled,
   });
}

export function useSubscribeCycleCalendar() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: (teamId: string) => cyclesService.subscribeCalendar(teamId),
      onSuccess: (subscription: CycleCalendarSubscription, teamId) => {
         queryClient.setQueryData(cycleKeys.calendarSubscription(teamId), subscription);
         toast.success('Cycle calendar subscription created');
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to create cycle calendar subscription');
      },
   });
}

export function useUnsubscribeCycleCalendar() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: (teamId: string) => cyclesService.unsubscribeCalendar(teamId),
      onSuccess: (subscription: CycleCalendarSubscription, teamId) => {
         queryClient.setQueryData(cycleKeys.calendarSubscription(teamId), subscription);
         toast.success('Cycle calendar subscription revoked');
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to revoke cycle calendar subscription');
      },
   });
}

export function useUpdateCycle() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<Cycle> }) =>
         cyclesService.updateCycle(id, payload),
      onSuccess: (_data, { id }) => {
         queryClient.invalidateQueries({ queryKey: cycleKeys.lists() });
         queryClient.invalidateQueries({ queryKey: cycleKeys.detail(id) });
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to update cycle');
      },
   });
}

export function useStartCycleToday() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: (id: string) => cyclesService.startCycleToday(id),
      onSuccess: (cycle) => {
         queryClient.invalidateQueries({ queryKey: cycleKeys.lists() });
         queryClient.invalidateQueries({ queryKey: cycleKeys.detail(cycle.id) });
         toast.success(`${cycle.name} started today`);
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to start cycle today');
      },
   });
}

export function useDeleteCycle() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: (id: string) => cyclesService.deleteCycle(id),
      onSuccess: (_, id) => {
         queryClient.invalidateQueries({ queryKey: cycleKeys.lists() });
         queryClient.removeQueries({ queryKey: cycleKeys.detail(id) });
         toast.success('Cycle deleted');
      },
      onError: (error: Error) => {
         toast.error(error.message || 'Failed to delete cycle');
      },
   });
}
