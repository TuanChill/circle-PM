import { create } from 'zustand';

export type PresenceStatus = 'online' | 'away' | 'offline';

interface PresenceState {
   presenceMap: Record<string, PresenceStatus>;
   setPresence: (map: Record<string, PresenceStatus>) => void;
   setUserPresence: (userId: string, status: PresenceStatus) => void;
   getStatus: (userId: string, fallback?: string) => PresenceStatus;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
   presenceMap: {},
   setPresence: (map) =>
      set((state) => ({
         presenceMap: { ...state.presenceMap, ...map },
      })),
   setUserPresence: (userId, status) =>
      set((state) => ({
         presenceMap: { ...state.presenceMap, [userId]: status },
      })),
   getStatus: (userId, fallback = 'offline') =>
      get().presenceMap[userId] ?? (fallback as PresenceStatus),
}));
