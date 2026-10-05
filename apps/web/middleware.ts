import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ROUTES } from '@/constants/routes';
import { getSavedWorkspaceFromRequest } from '@/lib/utils/workspace-persistence';

export function middleware(request: NextRequest) {
   const { pathname } = request.nextUrl;

   // Public assets and Next internals
   if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/static') ||
      pathname.includes('.') ||
      pathname === '/favicon.ico'
   ) {
      return NextResponse.next();
   }

   const accessToken = request.cookies.get('accessToken')?.value;
   const isAuthPage =
      pathname === ROUTES.AUTH.LOGIN ||
      pathname === ROUTES.AUTH.SIGNUP ||
      pathname === ROUTES.AUTH.FORGOT_PASSWORD ||
      pathname === ROUTES.AUTH.RESET_PASSWORD;
   const isInvitationSignup =
      pathname === ROUTES.AUTH.SIGNUP && Boolean(request.nextUrl.searchParams.get('invite'));

   // If accessing auth page while already logged in -> redirect to default/previously opened workspace
   // Invitation signups are an exception: the signup page accepts the invitation
   // token for the authenticated member before navigating to the invited workspace.
   if (isAuthPage && accessToken && !isInvitationSignup) {
      const lastWorkspace = getSavedWorkspaceFromRequest(request);
      const url = request.nextUrl.clone();
      url.pathname = lastWorkspace
         ? ROUTES.DEFAULT_WORKSPACE_DASHBOARD(lastWorkspace)
         : ROUTES.ONBOARDING;
      return NextResponse.redirect(url);
   }

   // If accessing protected workspace without token -> redirect to login
   if (!isAuthPage && !accessToken && pathname !== '/') {
      const url = request.nextUrl.clone();
      url.pathname = ROUTES.AUTH.LOGIN;
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
   }

   return NextResponse.next();
}

export const config = {
   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
