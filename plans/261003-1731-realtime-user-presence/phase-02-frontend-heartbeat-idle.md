---
phase: 2
title: "Frontend Heartbeat & Idle Detection Hook"
status: completed
priority: P1
effort: "3h"
dependencies: ["phase-01-backend-presence-service"]
---

# Phase 2: Frontend Heartbeat & Idle Detection Hook

## Overview

Implement the client-side presence heartbeat loop with user activity monitoring and idle detection in `apps/web`. The hook automatically sends periodic pings to the backend and transitions status between `online` and `away`.

## Requirements

### Functional
- `usePresenceHeartbeat` hook:
  - Sends heartbeat to `POST /circle/api/presence/heartbeat` every 25 seconds.
  - Monitors user input events (`mousemove`, `keydown`, `wheel`, `pointerdown`, `touchstart`).
  - Sets state to `away` if no input is recorded for 5 consecutive minutes (300,000 ms) or if `document.visibilityState === 'hidden'` for more than 1 minute.
  - Automatically recovers to `online` immediately upon the first user interaction after being `away`.
  - Sends immediate heartbeat with `online` status on tab refocus (`visibilitychange`).
- Presence Lifecycle Provider:
  - Embed inside workspace root layout (`apps/web/app/[orgId]/layout.tsx`).
  - Only executes when an authenticated user session is active and a workspace is selected.
  - Stops timers and event listeners on logout or unmount.

### Non-functional
- Throttled event listeners: user interaction listeners must be passive and throttled (e.g. update `lastActive` at most once every 5 seconds) to prevent main-thread lag.
- Efficient network usage: payload is small (< 100 bytes); failed pings retry quietly without user-facing toasts.

## Architecture

```
 User Actions (mouse, keys, scroll)
              │
              ▼ (throttled to 5s)
     update lastActive timestamp
              │
    ┌─────────┴─────────┐
    │  Heartbeat Timer  │ (fires every 25s)
    └─────────┬─────────┘
              │
       Is Idle > 5m?
      ┌───────┴───────┐
     Yes              No
      │                │
status: 'away'    status: 'online'
      │                │
      └───────┬────────┘
              ▼
   POST /circle/api/presence/heartbeat
   { workspaceId, status }
```

## Related Code Files

### Create
- `apps/web/services/presence.service.ts`
- `apps/web/hooks/use-presence-heartbeat.ts`
- `apps/web/components/providers/presence-provider.tsx`

### Modify
- `apps/web/app/[orgId]/layout.tsx` (mount `PresenceProvider`)

## Implementation Steps

1. **Create Presence Service**:
   - In `apps/web/services/presence.service.ts`, add:
     ```typescript
     export const presenceService = {
       async sendHeartbeat(workspaceId: string, status: 'online' | 'away'): Promise<void> {
         return apiClient('/presence/heartbeat', {
           method: 'POST',
           body: JSON.stringify({ workspaceId, status }),
         });
       },
     };
     ```
2. **Build `usePresenceHeartbeat` Hook**:
   - Track `lastActiveAt` using a ref (`useRef(Date.now())`).
   - Listen to `['mousemove', 'keydown', 'wheel', 'pointerdown', 'touchstart']` with `passive: true`.
   - Throttle interaction recording: only update ref if `Date.now() - lastActiveAt > 5000`.
   - Setup `setInterval` running every 25 seconds:
     - Check: `const isAway = Date.now() - lastActiveAt > 5 * 60 * 1000 || document.hidden`.
     - Dispatch `presenceService.sendHeartbeat(workspaceId, isAway ? 'away' : 'online')`.
   - On tab visibility change:
     - If returning to `visible`, reset `lastActiveAt = Date.now()` and send immediate `online` heartbeat.
3. **Mount `PresenceProvider` in `app/[orgId]/layout.tsx`**:
   - Extract `orgId` / workspace context.
   - Invoke `usePresenceHeartbeat(workspaceId)` inside `<PresenceProvider />`.

## Success Criteria

- [x] Network tab shows `POST /circle/api/presence/heartbeat` payload `{ status: 'online' }` every 25s while active.
- [x] Leaving tab untouched for 5 minutes switches subsequent heartbeat payload to `{ status: 'away' }`.
- [x] Moving mouse or typing after being idle resets status to `online` immediately and fires a heartbeat.
- [x] No unhandled errors or console noise when tab is backgrounded.

## Risk Assessment

- **Risk**: Multiple open tabs from the same user sending duplicate heartbeats and clashing idle states.
  - **Observable Signal**: Rapid alternating between `online` and `away` in Redis.
  - **Mitigation**: Status `online` takes precedence in Redis; the user is considered online as long as *any* tab is actively interacted with.
