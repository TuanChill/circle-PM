import { create } from 'zustand';
import {
   AuthResponse,
   AuthUser,
   login as apiLogin,
   logout as apiLogout,
   signUp as apiSignUp,
   loginWithGoogle as apiLoginWithGoogle,
   LoginPayload,
   SignUpPayload,
   GoogleAuthPayload,
} from '@/lib/api/auth';
import { getCookie, removeCookie, setCookie } from '@/lib/utils/cookies';
import { clearActiveWorkspace } from '@/lib/utils/workspace-persistence';

interface AuthState {
   user: AuthUser | null;
   accessToken: string | null;
   isAuthenticated: boolean;
   isLoading: boolean;
   isSessionInitialized: boolean;

   initSession: () => void;
   login: (payload: LoginPayload) => Promise<AuthResponse>;
   signUp: (payload: SignUpPayload) => Promise<AuthResponse>;
   loginWithGoogle: (payload: GoogleAuthPayload) => Promise<AuthResponse>;
   logout: () => Promise<void>;
   setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
   user: null,
   accessToken: null,
   isAuthenticated: false,
   isLoading: false,
   isSessionInitialized: false,

   initSession: () => {
      const token = getCookie('accessToken');
      const userCookie = getCookie('currentUser');
      let parsedUser: AuthUser | null = null;
      if (userCookie) {
         try {
            parsedUser = JSON.parse(userCookie);
         } catch {
            parsedUser = null;
         }
      }

      if (token && parsedUser) {
         set({
            accessToken: token,
            user: parsedUser,
            isAuthenticated: true,
            isSessionInitialized: true,
         });
      } else {
         removeCookie('accessToken');
         removeCookie('refreshToken');
         removeCookie('currentUser');
         set({
            accessToken: null,
            user: null,
            isAuthenticated: false,
            isSessionInitialized: true,
         });
      }
   },

   login: async (payload: LoginPayload) => {
      set({ isLoading: true });
      try {
         const res = await apiLogin(payload);
         if (!res.user) {
            throw new Error('Login response is missing user data');
         }
         const user = res.user;

         if (res.accessToken) {
            setCookie('accessToken', res.accessToken, 7);
         }
         if (res.refreshToken) {
            setCookie('refreshToken', res.refreshToken, 30);
         }
         setCookie('currentUser', JSON.stringify(user), 7);

         set({
            user,
            accessToken: res.accessToken,
            isAuthenticated: true,
            isLoading: false,
            isSessionInitialized: true,
         });
         return res;
      } catch (err) {
         set({ isLoading: false });
         throw err;
      }
   },

   signUp: async (payload: SignUpPayload) => {
      set({ isLoading: true });
      try {
         const res = await apiSignUp(payload);
         if (!res.user) {
            throw new Error('Sign up response is missing user data');
         }
         const user = res.user;

         if (res.accessToken) {
            setCookie('accessToken', res.accessToken, 7);
         }
         if (res.refreshToken) {
            setCookie('refreshToken', res.refreshToken, 30);
         }
         setCookie('currentUser', JSON.stringify(user), 7);

         set({
            user,
            accessToken: res.accessToken,
            isAuthenticated: true,
            isLoading: false,
            isSessionInitialized: true,
         });
         return res;
      } catch (err) {
         set({ isLoading: false });
         throw err;
      }
   },

   loginWithGoogle: async (payload: GoogleAuthPayload) => {
      set({ isLoading: true });
      try {
         const res = await apiLoginWithGoogle(payload);
         if (!res.user) {
            throw new Error('Google login response is missing user data');
         }
         const user = res.user;

         if (res.accessToken) {
            setCookie('accessToken', res.accessToken, 7);
         }
         if (res.refreshToken) {
            setCookie('refreshToken', res.refreshToken, 30);
         }
         setCookie('currentUser', JSON.stringify(user), 7);

         set({
            user,
            accessToken: res.accessToken,
            isAuthenticated: true,
            isLoading: false,
            isSessionInitialized: true,
         });
         return res;
      } catch (err) {
         set({ isLoading: false });
         throw err;
      }
   },

   logout: async () => {
      set({ isLoading: true });
      try {
         await apiLogout();
      } finally {
         removeCookie('accessToken');
         removeCookie('refreshToken');
         removeCookie('currentUser');
         clearActiveWorkspace();
         set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
            isSessionInitialized: true,
         });
         if (typeof window !== 'undefined') {
            window.location.href = '/login';
         }
      }
   },

   setUser: (user: AuthUser | null) => {
      set({ user, isAuthenticated: !!user });
      if (user) {
         setCookie('currentUser', JSON.stringify(user), 7);
      } else {
         removeCookie('currentUser');
      }
   },
}));
