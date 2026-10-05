'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';

import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleLoginButton } from '@/components/auth/google-login-button';
import { ROUTES } from '@/constants/routes';
import { useJoinWorkspace } from '@/hooks/queries';
import { saveActiveWorkspace } from '@/lib/utils/workspace-persistence';

const signupSchema = z.object({
   name: z.string().min(2, 'Name must be at least 2 characters'),
   email: z.string().email('Please enter a valid email address'),
   password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

function SignUpForm() {
   const router = useRouter();
   const searchParams = useSearchParams();
   const inviteEmail = searchParams.get('email') || '';
   const invitationToken = searchParams.get('invite');
   const { signUp, isAuthenticated, isLoading } = useAuthStore();
   const joinWorkspaceMutation = useJoinWorkspace();
   const [showPassword, setShowPassword] = React.useState(false);
   const hasAcceptedInvitation = React.useRef(false);

   const {
      register,
      handleSubmit,
      formState: { errors },
   } = useForm<SignupFormValues>({
      resolver: zodResolver(signupSchema),
      defaultValues: {
         name: '',
         email: inviteEmail,
         password: '',
      },
   });

   React.useEffect(() => {
      if (!isAuthenticated || !invitationToken || hasAcceptedInvitation.current) return;

      hasAcceptedInvitation.current = true;
      void joinWorkspaceMutation
         .mutateAsync({ invitationToken })
         .then((workspace) => {
            saveActiveWorkspace(workspace.slug);
            router.replace(ROUTES.WORKSPACE.MY_ISSUES(workspace.slug));
         })
         .catch(() => {
            // The mutation displays the invitation error and leaves the page available.
         });
   }, [invitationToken, isAuthenticated, joinWorkspaceMutation, router]);

   const onSubmit = async (data: SignupFormValues) => {
      try {
         await signUp(data);

         if (invitationToken) {
            const workspace = await joinWorkspaceMutation.mutateAsync({ invitationToken });
            router.push(ROUTES.WORKSPACE.MY_ISSUES(workspace.slug));
            return;
         }

         toast.success("Account created! Let's set up your workspace.");
         router.push(ROUTES.ONBOARDING);
         setTimeout(() => {
            if (typeof window !== 'undefined' && window.location.pathname === ROUTES.AUTH.SIGNUP) {
               window.location.href = ROUTES.ONBOARDING;
            }
         }, 100);
      } catch (err: unknown) {
         const message = err instanceof Error ? err.message : 'Could not create account';
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
               <h1 className="text-xl font-semibold tracking-tight">Create an account</h1>
               <p className="text-xs text-muted-foreground mt-1.5">
                  Join Circle and start managing your workspace
               </p>
            </div>

            {/* Google Sign-up Button */}
            <div className="mb-4">
               <GoogleLoginButton text="Sign up with Google" />
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
               {/* Name */}
               <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium">
                     Full Name
                  </Label>
                  <div className="relative">
                     <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                     <Input
                        id="name"
                        placeholder="Leonel Ngoya"
                        className="pl-9 h-9 text-sm bg-background/50 border-input"
                        autoComplete="name"
                        {...register('name')}
                     />
                  </div>
                  {errors.name && (
                     <p className="text-[11px] text-destructive">{errors.name.message}</p>
                  )}
               </div>

               {/* Email */}
               <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">
                     Work Email
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
                  <Label htmlFor="password" className="text-xs font-medium">
                     Password
                  </Label>
                  <div className="relative">
                     <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                     <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-9 pr-9 h-9 text-sm bg-background/50 border-input"
                        autoComplete="new-password"
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
                        Create Workspace Account
                        <ArrowRight className="size-3.5 ml-1.5" />
                     </>
                  )}
               </Button>
            </form>
         </div>

         {/* Bottom link */}
         <p className="text-xs text-muted-foreground mt-6 text-center">
            Already have an account?{' '}
            <Link
               href={ROUTES.AUTH.LOGIN}
               className="font-medium text-foreground hover:underline transition-all"
            >
               Log in
            </Link>
         </p>
      </div>
   );
}

export default function SignUpPage() {
   return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
         <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none rounded-full" />

         <React.Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
            <SignUpForm />
         </React.Suspense>
      </div>
   );
}
