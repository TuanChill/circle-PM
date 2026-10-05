'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth-store';
import { useJoinWorkspace } from '@/hooks/queries/use-workspaces-query';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { getActiveWorkspace, saveActiveWorkspace } from '@/lib/utils/workspace-persistence';

export function GoogleIcon() {
   return (
      <svg className="size-4 shrink-0 mr-2" viewBox="0 0 24 24">
         <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
         />
         <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
         />
         <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
         />
         <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
         />
      </svg>
   );
}

interface GoogleLoginButtonProps {
   text?: string;
}

export function GoogleLoginButton({ text = 'Continue with Google' }: GoogleLoginButtonProps) {
   const router = useRouter();
   const searchParams = useSearchParams();

   const { loginWithGoogle, isLoading } = useAuthStore();
   const joinWorkspaceMutation = useJoinWorkspace();
   const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
   const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

   const googleLogin = useGoogleLogin({
      onSuccess: async (tokenResponse) => {
         setIsGoogleLoading(true);
         try {
            // Fetch Google user profile with access token
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
               headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });

            if (!userInfoRes.ok) {
               throw new Error('Unable to verify the Google profile');
            }
            const userInfo = await userInfoRes.json();
            if (typeof userInfo.email !== 'string' || !userInfo.email) {
               throw new Error('Google profile did not include an email address');
            }
            const profile = {
               email: userInfo.email,
               name:
                  typeof userInfo.name === 'string' && userInfo.name
                     ? userInfo.name
                     : userInfo.email.split('@')[0],
               picture: typeof userInfo.picture === 'string' ? userInfo.picture : undefined,
            };

            const res = await loginWithGoogle({
               idToken: tokenResponse.access_token,
               profile,
            });

            const invitationToken = searchParams.get('invite');
            const invitedWorkspace = invitationToken
               ? await joinWorkspaceMutation.mutateAsync({ invitationToken })
               : undefined;

            toast.success(`Welcome, ${profile.name}!`);
            const savedWorkspace = getActiveWorkspace();
            const destinationSlug =
               invitedWorkspace?.slug || savedWorkspace || res?.workspace?.slug;
            if (destinationSlug) {
               saveActiveWorkspace(destinationSlug);
            }
            const targetUrl =
               (invitedWorkspace?.slug
                  ? ROUTES.WORKSPACE.MY_ISSUES(invitedWorkspace.slug)
                  : searchParams.get('redirect')) ||
               (res?.isNewUser
                  ? ROUTES.ONBOARDING
                  : destinationSlug
                    ? ROUTES.WORKSPACE.MY_ISSUES(destinationSlug)
                    : ROUTES.ONBOARDING);
            router.replace(targetUrl);
         } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Google Sign-in failed';
            toast.error(message);
         } finally {
            setIsGoogleLoading(false);
         }
      },
      onError: (error) => {
         setIsGoogleLoading(false);
         toast.error(error.error_description || 'Google Sign-in was cancelled or failed');
      },
   });

   return (
      <Button
         type="button"
         variant="outline"
         disabled={!googleClientId || isLoading || isGoogleLoading}
         onClick={() => {
            if (!googleClientId) {
               toast.error('Google sign-in is not configured');
               return;
            }
            googleLogin();
         }}
         className="w-full h-9 text-xs font-medium border-border/70 hover:bg-accent/60 transition-all flex items-center justify-center shadow-sm"
      >
         {isGoogleLoading ? (
            <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
         ) : (
            <GoogleIcon />
         )}
         {text}
      </Button>
   );
}
