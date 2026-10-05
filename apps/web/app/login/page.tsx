'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';

import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleLoginButton } from '@/components/auth/google-login-button';
import { ROUTES } from '@/constants/routes';
import { useJoinWorkspace } from '@/hooks/queries';
import { getActiveWorkspace, saveActiveWorkspace } from '@/lib/utils/workspace-persistence';

const loginSchema = z.object({
   email: z.string().email('Please enter a valid email address'),
   password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
   const router = useRouter();
   const searchParams = useSearchParams();
   const invitationToken = searchParams.get('invite');
   const inviteEmail = searchParams.get('email') || '';

   const { login, isLoading } = useAuthStore();
   const joinWorkspaceMutation = useJoinWorkspace();
   const [showPassword, setShowPassword] = React.useState(false);

   const {
      register,
      handleSubmit,
      formState: { errors },
   } = useForm<LoginFormValues>({
      resolver: zodResolver(loginSchema),
      defaultValues: {
         email: inviteEmail,
         password: '',
      },
   });

   const onSubmit = async (data: LoginFormValues) => {
      try {
         const res = await login(data);
         const invitedWorkspace = invitationToken
            ? await joinWorkspaceMutation.mutateAsync({ invitationToken })
            : undefined;
         toast.success('Welcome back!');
         const savedWorkspace = getActiveWorkspace();
         const destinationSlug = invitedWorkspace?.slug || savedWorkspace || res?.workspace?.slug;
         if (destinationSlug) {
            saveActiveWorkspace(destinationSlug);
         }
         const targetUrl =
            (invitedWorkspace?.slug
               ? ROUTES.WORKSPACE.MY_ISSUES(invitedWorkspace.slug)
               : searchParams.get('redirect')) ||
            (destinationSlug ? ROUTES.WORKSPACE.MY_ISSUES(destinationSlug) : ROUTES.ONBOARDING);
         router.replace(targetUrl);
      } catch (err: unknown) {
         const message = err instanceof Error ? err.message : 'Invalid email or password';
         toast.error(message);
      }
   };

   return (
      <div className="w-full max-w-[380px] z-10 flex flex-col items-center">
         {/* Brand Logo */}
         <div className="flex items-center gap-2 mb-6">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-bold text-sm shadow-md shadow-orange-500/20">
               <svg
                  className="size-4.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
               >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
               </svg>
            </div>
            <span className="font-semibold text-lg tracking-tight">Circle</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
               v2.0
            </span>
         </div>

         {/* Auth Card */}
         <div className="w-full rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-7 shadow-2xl shadow-black/40">
            <div className="mb-6 text-center">
               <h1 className="text-xl font-semibold tracking-tight">Log in to your workspace</h1>
               <p className="text-xs text-muted-foreground mt-1.5">
                  Enter your credentials to access your issues and projects
               </p>
            </div>

            {/* Google Sign-in Button */}
            <div className="mb-4">
               <GoogleLoginButton text="Continue with Google" />
            </div>

            {/* Divider */}
            <div className="relative my-4 flex items-center justify-center">
               <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60" />
               </div>
               <span className="relative bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                  or
               </span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
               {/* Email */}
               <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">
                     Email address
                  </Label>
                  <div className="relative">
                     <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                     <Input
                        id="email"
                        type="email"
                        placeholder="name@company.com"
                        className="pl-9 h-9 text-sm bg-background/50 border-input"
                        autoComplete="email"
                        {...register('email')}
                     />
                  </div>
                  {errors.email && (
                     <p className="text-[11px] text-destructive">{errors.email.message}</p>
                  )}
               </div>

               {/* Password */}
               <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                     <Label htmlFor="password" className="text-xs font-medium">
                        Password
                     </Label>
                     <Link
                        href="/forgot-password"
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                     >
                        Forgot?
                     </Link>
                  </div>
                  <div className="relative">
                     <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                     <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-9 pr-9 h-9 text-sm bg-background/50 border-input"
                        autoComplete="current-password"
                        {...register('password')}
                     />
                     <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                     >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                     </button>
                  </div>
                  {errors.password && (
                     <p className="text-[11px] text-destructive">{errors.password.message}</p>
                  )}
               </div>

               {/* Submit Button */}
               <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-9 mt-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
               >
                  {isLoading ? (
                     <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                     <>
                        Continue with Email
                        <ArrowRight className="size-3.5 ml-1.5" />
                     </>
                  )}
               </Button>
            </form>
         </div>

         {/* Bottom link */}
         <p className="text-xs text-muted-foreground mt-6 text-center">
            Don&apos;t have an account?{' '}
            <Link
               href={
                  invitationToken
                     ? ROUTES.AUTH.SIGNUP_WITH_INVITATION(invitationToken, inviteEmail)
                     : ROUTES.AUTH.SIGNUP
               }
               className="font-medium text-foreground hover:underline transition-all"
            >
               Sign up
            </Link>
         </p>
      </div>
   );
}

export default function LoginPage() {
   return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
         {/* Subtle background glow */}
         <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none rounded-full" />

         <React.Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
            <LoginForm />
         </React.Suspense>
      </div>
   );
}
