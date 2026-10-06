'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspaces } from '@/hooks/queries';
import { useAuthStore } from '@/store/auth-store';
import { useNotificationsStore } from '@/store/notifications-store';
import { ROUTES } from '@/constants/routes';
import { getActiveWorkspace, saveActiveWorkspace } from '@/lib/utils/workspace-persistence';
import QueryErrorState from '@/components/common/query-error-state';
import { PresenceProvider } from '@/components/providers/presence-provider';

export default function WorkspaceOrgLayout({ children }: { children: React.ReactNode }) {
   const router = useRouter();
   const params = useParams<{ orgId?: string }>();
   const currentOrgId = params?.orgId;
   const { isAuthenticated } = useAuthStore();
   const {
      data: workspaces,
      isLoading,
      isFetching,
      isFetched,
      isError: isWorkspacesError,
      error: workspacesError,
      refetch: refetchWorkspaces,
   } = useWorkspaces();
   const { initNotifications, isInitialized: notificationsInitialized } = useNotificationsStore();

   const matchingWorkspace = workspaces?.find(
      (ws) => ws.slug === currentOrgId || ws.id === currentOrgId
   );

   React.useEffect(() => {
      if (isAuthenticated && !notificationsInitialized) {
         initNotifications();
      }
   }, [isAuthenticated, notificationsInitialized, initNotifications]);

   React.useEffect(() => {
      // Do not make routing decisions while initial fetch or background refetch is in progress
      if (isLoading || isFetching || !isFetched) return;

      // If user is authenticated but confirmed to have 0 workspaces -> Force them to onboarding
      if (isAuthenticated && workspaces && workspaces.length === 0) {
         router.replace(ROUTES.ONBOARDING);
         return;
      }

      // If user has workspaces, ensure the current orgId is valid for this user
      if (workspaces && workspaces.length > 0 && currentOrgId) {
         const matchingWorkspace = workspaces.find(
            (ws) => ws.slug === currentOrgId || ws.id === currentOrgId
         );

         // If the user navigated to an invalid orgId (e.g. legacy lndev-ui or foreign slug)
         if (!matchingWorkspace) {
            const savedWorkspaceSlug = getActiveWorkspace();
            const validSaved = workspaces.find(
               (ws) => ws.slug === savedWorkspaceSlug || ws.id === savedWorkspaceSlug
            );
            const fallbackSlug = validSaved?.slug || workspaces[0].slug || workspaces[0].id;
            saveActiveWorkspace(fallbackSlug);
            router.replace(ROUTES.WORKSPACE.MY_ISSUES(fallbackSlug));
            return;
         }

         // Automatically persist the currently opened workspace so it is remembered upon return
         saveActiveWorkspace(matchingWorkspace.slug);
      }
   }, [workspaces, isLoading, isFetching, isFetched, isAuthenticated, currentOrgId, router]);

   // Do not render workspace-scoped children until the authenticated workspace
   // has been resolved. This prevents child queries from firing against a
   // legacy/foreign orgId (for example /my-workspace) before the redirect runs.
   if (isAuthenticated && isWorkspacesError) {
      return (
         <QueryErrorState
            subject="workspaces"
            error={workspacesError}
            onRetry={refetchWorkspaces}
         />
      );
   }

   if (isAuthenticated && (!isFetched || isLoading || !workspaces?.length || !matchingWorkspace)) {
      return null;
   }

   return <PresenceProvider workspaceId={matchingWorkspace?.id}>{children}</PresenceProvider>;
}
