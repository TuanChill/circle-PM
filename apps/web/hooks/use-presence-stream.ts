'use client';

import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/lib/api/base-url';
import { getCookie } from '@/lib/utils/cookies';
import { usePresenceStore, PresenceStatus } from '@/store/presence-store';

export function usePresenceStream(workspaceId?: string) {
   const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const eventSourceRef = useRef<EventSource | null>(null);

   useEffect(() => {
      if (!workspaceId || typeof window === 'undefined') return;

      let isCleanedUp = false;

      const connect = () => {
         if (isCleanedUp) return;

         // Close any existing connection
         if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
         }

         const token = getCookie('accessToken');
         if (!token) return;

         const url = `${API_BASE_URL}/circle/api/presence/stream?workspaceId=${encodeURIComponent(
            workspaceId
         )}&token=${encodeURIComponent(token)}`;

         try {
            const es = new EventSource(url);
            eventSourceRef.current = es;

            es.onmessage = (event) => {
               try {
                  const payload = JSON.parse(event.data);
                  if (payload?.presence && typeof payload.presence === 'object') {
                     usePresenceStore
                        .getState()
                        .setPresence(payload.presence as Record<string, PresenceStatus>);
                  }
               } catch (err) {
                  console.debug('[PresenceStream] Failed to parse SSE frame:', err);
               }
            };

            es.onerror = () => {
               es.close();
               eventSourceRef.current = null;

               // Schedule reconnect after 5s unless cleaned up
               if (!isCleanedUp && !reconnectTimeoutRef.current) {
                  reconnectTimeoutRef.current = setTimeout(() => {
                     reconnectTimeoutRef.current = null;
                     connect();
                  }, 5_000);
               }
            };
         } catch (err) {
            console.debug('[PresenceStream] Connection error:', err);
         }
      };

      connect();

      const handleVisibilityChange = () => {
         if (document.visibilityState === 'visible' && !eventSourceRef.current) {
            connect();
         }
      };

      const handleOnline = () => {
         connect();
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('online', handleOnline);

      return () => {
         isCleanedUp = true;
         if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
         }
         if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
         }
         document.removeEventListener('visibilitychange', handleVisibilityChange);
         window.removeEventListener('online', handleOnline);
      };
   }, [workspaceId]);
}
