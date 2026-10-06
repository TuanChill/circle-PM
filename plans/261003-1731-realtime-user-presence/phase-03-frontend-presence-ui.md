---
phase: 3
title: "Frontend Real-time Presence UI & Store"
status: completed
priority: P1
effort: "3h"
dependencies: ["phase-01-backend-presence-service", "phase-02-frontend-heartbeat-idle"]
---

# Phase 3: Frontend Real-time Presence UI & Store

## Overview

Connect the frontend to the backend SSE presence stream, manage incoming presence events with a reactive Zustand store, and update the member list and profile views to reflect live status indicators without page reload.

## Requirements

### Functional
- `usePresenceStore` (Zustand):
  - State: `presenceMap: Record<string, 'online' | 'away' | 'offline'>`.
  - Actions: `setPresence(map)`, `setUserPresence(userId, status)`.
  - Helper selector: `getStatus(userId: string, fallback?: string): 'online' | 'away' | 'offline'`.
- `usePresenceStream` Hook:
  - Initializes `EventSource` to `/circle/api/presence/stream?workspaceId={id}&token={accessToken}`.
  - Parses incoming JSON messages containing workspace presence updates and feeds them into `usePresenceStore`.
  - Handles network interruptions with automatic reconnect and clean teardown on unmount.
- UI Components Integration:
  - `MemberLine` (`apps/web/components/common/members/member-line.tsx`):
    - Subscribes to `usePresenceStore(state => state.getStatus(user.id, user.status))`.
    - Live displays green indicator (`#00cc66`) when status is `online`.
    - Updates dynamically in real time without table re-render or page reload.
  - `MemberProfile` (`apps/web/components/common/members/member-profile.tsx`):
    - Reads presence status from the store.
    - Updates avatar status badge dot (`#00cc66` for online, `#ffcc00` for away, `#969696` for offline).
    - Updates header text (`"Online now"`, `"Away"`, or `"Offline"`).

### Non-functional
- Zero unnecessary re-renders: selector usage ensures a component only re-renders when *its specific member's* status changes.
- Safe SSR: hooks and EventSource instantiation must only execute in client environments (`typeof window !== 'undefined'`).

## Architecture

```
 SSE Stream (Backend /circle/api/presence/stream)
                       │
                       ▼
               usePresenceStream
                       │ (dispatches data)
                       ▼
          usePresenceStore (Zustand)
         ┌─────────────┴─────────────┐
         ▼                           ▼
 MemberLine Component       MemberProfile Component
 (list item online tag)      (avatar dot & label)
```

## Related Code Files

### Create
- `apps/web/store/presence-store.ts`
- `apps/web/hooks/use-presence-stream.ts`

### Modify
- `apps/web/components/providers/presence-provider.tsx` (activate `usePresenceStream`)
- `apps/web/components/common/members/member-line.tsx` (consume presence store)
- `apps/web/components/common/members/member-profile.tsx` (consume presence store)

## Implementation Steps

1. **Implement `usePresenceStore` with Zustand**:
   - Create `apps/web/store/presence-store.ts`:
     ```typescript
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
       setPresence: (map) => set({ presenceMap: { ...get().presenceMap, ...map } }),
       setUserPresence: (userId, status) =>
         set((state) => ({ presenceMap: { ...state.presenceMap, [userId]: status } })),
       getStatus: (userId, fallback = 'offline') =>
         get().presenceMap[userId] ?? (fallback as PresenceStatus),
     }));
     ```
2. **Implement `usePresenceStream`**:
   - Create `apps/web/hooks/use-presence-stream.ts`.
   - Read `accessToken` from cookie using `getCookie('accessToken')`.
   - Instantiate `new EventSource(`${API_BASE_URL}/circle/api/presence/stream?workspaceId=${wsId}&token=${token}`)`.
   - Listen to `onmessage` event, parse data `{ presence: Record<string, PresenceStatus> }`, call `setPresence(data.presence)`.
   - On `onerror`, close and retry after exponential backoff.
   - Clean up (`eventSource.close()`) on component unmount or workspace switch.
3. **Mount Stream Hook in `PresenceProvider`**:
   - Call `usePresenceStream(workspaceId)` inside `PresenceProvider`.
4. **Update `member-line.tsx`**:
   - Replace reading `user.status === 'online'` with:
     ```typescript
     const liveStatus = usePresenceStore((state) => state.getStatus(user.id, user.status));
     // Render online badge when liveStatus === 'online' && !isApplication
     ```
5. **Update `member-profile.tsx`**:
   - Replace reading `member.status` directly with:
     ```typescript
     const liveStatus = usePresenceStore((state) => state.getStatus(member.id, member.status));
     // Use liveStatus for dot color and presenceLabel[liveStatus]
     ```

## Success Criteria

- [x] Opening two browser windows (or incognito with different users) connects both to the SSE stream.
- [x] User A logging in or sending a heartbeat immediately causes User B's member list to display User A as "Online".
- [x] User A going idle causes User B's profile view to update to "Away".
- [x] User A closing their browser window results in User A transitioning to "Offline" on User B's screen after Redis TTL expiration.
- [x] No hydration mismatch warnings during Next.js initial render.

## Risk Assessment

- **Risk**: EventSource connection drops when browser enters sleep mode.
  - **Observable Signal**: Stale presence data on waking up laptop.
  - **Mitigation**: Listen to `window.addEventListener('online')` and `visibilitychange` to force re-establishing the SSE connection immediately if dropped.
