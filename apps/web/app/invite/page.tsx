'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, LoaderCircle } from 'lucide-react';

import { ROUTES } from '@/constants/routes';
import { useJoinWorkspace } from '@/hooks/queries';
import { saveActiveWorkspace } from '@/lib/utils/workspace-persistence';
import { useAuthStore } from '@/store/auth-store';

function InviteEntry() {
   const router = useRouter();
   const searchParams = useSearchParams();
   const token = searchParams.get('token');
   const email = searchParams.get('email') || undefined;
   const { isAuthenticated, isSessionInitialized } = useAuthStore();
   const joinWorkspaceMutation = useJoinWorkspace();
   const hasStarted = React.useRef(false);
   const [error, setError] = React.useState<string | null>(null);

   React.useEffect(() => {
      if (!token || !isSessionInitialized || hasStarted.current) return;

      hasStarted.current = true;
      if (!isAuthenticated) {
         router.replace(ROUTES.AUTH.SIGNUP_WITH_INVITATION(token, email));
         return;
      }

      void joinWorkspaceMutation
         .mutateAsync({ invitationToken: token })
         .then((workspace) => {
            saveActiveWorkspace(workspace.slug);
            router.replace(ROUTES.WORKSPACE.MY_ISSUES(workspace.slug));
         })
         .catch((joinError: unknown) => {
            setError(
               joinError instanceof Error ? joinError.message : 'Could not accept this invitation'
            );
         });
   }, [email, isAuthenticated, isSessionInitialized, joinWorkspaceMutation, router, token]);

   const message = !token
      ? 'This invitation link is invalid.'
      : error
        ? error
        : isSessionInitialized
          ? 'Accepting your workspace invitation…'
          : 'Checking your session…';

   return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
         <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/60 p-7 text-center shadow-2xl shadow-black/40">
            {error || !token ? (
               <AlertCircle className="mx-auto mb-3 size-6 text-destructive" />
            ) : (
               <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-primary" />
            )}
            <h1 className="text-lg font-semibold">Workspace invitation</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
         </div>
      </main>
   );
}

export default function InvitePage() {
   return (
      <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
         <InviteEntry />
      </React.Suspense>
   );
}
