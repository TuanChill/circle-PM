'use client';

import { useEffect, useRef } from 'react';
import { presenceService } from '@/services/presence.service';

const HEARTBEAT_INTERVAL_MS = 25_000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_THROTTLE_MS = 5_000; // 5 seconds

export function usePresenceHeartbeat(workspaceId?: string) {
   const lastActiveRef = useRef<number>(Date.now());
   const lastSentStatusRef = useRef<'online' | 'away'>('online');
   const workspaceIdRef = useRef<string | undefined>(workspaceId);
   workspaceIdRef.current = workspaceId;

   useEffect(() => {
      if (!workspaceId || typeof window === 'undefined') return;

      const recordActivity = () => {
         const now = Date.now();
         if (now - lastActiveRef.current >= ACTIVITY_THROTTLE_MS) {
            lastActiveRef.current = now;

            // If user was away, immediately send online heartbeat
            if (lastSentStatusRef.current === 'away' && workspaceIdRef.current) {
               lastSentStatusRef.current = 'online';
               presenceService.sendHeartbeat(workspaceIdRef.current, 'online').catch(() => {});
            }
         }
      };

      const handleVisibilityChange = () => {
         if (document.visibilityState === 'visible') {
            lastActiveRef.current = Date.now();
            if (workspaceIdRef.current) {
               lastSentStatusRef.current = 'online';
               presenceService.sendHeartbeat(workspaceIdRef.current, 'online').catch(() => {});
            }
         }
      };

      const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'pointerdown'] as const;
      events.forEach((event) => {
         window.addEventListener(event, recordActivity, { passive: true });
      });
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Initial heartbeat immediately upon mount
      presenceService.sendHeartbeat(workspaceId, 'online').catch(() => {});

      // Heartbeat timer every 25s
      const timer = setInterval(() => {
         const currentWsId = workspaceIdRef.current;
         if (!currentWsId) return;

         const isIdle =
            Date.now() - lastActiveRef.current >= IDLE_TIMEOUT_MS ||
            document.visibilityState === 'hidden';
         const status: 'online' | 'away' = isIdle ? 'away' : 'online';

         lastSentStatusRef.current = status;
         presenceService.sendHeartbeat(currentWsId, status).catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);

      return () => {
         clearInterval(timer);
         events.forEach((event) => {
            window.removeEventListener(event, recordActivity);
         });
         document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
   }, [workspaceId]);
}
