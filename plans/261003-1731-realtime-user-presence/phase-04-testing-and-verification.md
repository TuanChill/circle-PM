---
phase: 4
title: "Testing, Error Handling & Verification"
status: completed
priority: P2
effort: "3h"
dependencies: ["phase-01-backend-presence-service", "phase-02-frontend-heartbeat-idle", "phase-03-frontend-presence-ui"]
---

# Phase 4: Testing, Error Handling & Verification

## Overview

Execute comprehensive test suites and live verification to ensure the real-time presence system handles network dropouts, Redis reconnections, multi-tab usage, and idle timeouts reliably without memory leaks.

## Requirements

### Functional
- Backend unit tests covering `PresenceService` and `PresenceController`.
- Verification of SSE protocol headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`).
- Integration tests verifying:
  - Setting presence with TTL in Redis.
  - Automatic transition to `offline` when key expires.
  - Graceful fallback when Redis is unavailable.
- Manual multi-session test verifying live UI badge updates.

### Non-functional
- Zero unhandled promise rejections or memory leaks from long-running SSE observables.
- Code passes type check (`tsc --noEmit`) and linting (`oxlint` / `eslint`) across all packages.

## Test Matrix

| Area | Test Case | Expected Behavior |
|------|-----------|-------------------|
| Backend | `PresenceService.recordHeartbeat` | Writes `presence:user:{id}` with 60s TTL; adds user to workspace set |
| Backend | `PresenceService.getWorkspacePresence` | Returns map of online/away users; prunes expired keys from set |
| Backend | `GET /circle/api/presence/stream` | Emits `MessageEvent` with `presence:update` payload every 10s |
| Backend | Missing/Invalid JWT on SSE | Returns 401 Unauthorized |
| Frontend | Heartbeat loop | Sends POST heartbeat every 25s while user interacts |
| Frontend | Idle detection | Switches payload to `away` after 5 minutes of inactivity |
| Frontend | SSE Reconnect | Automatically reconnects with exponential backoff on disconnect |
| Resiliency | Redis Outage | Member list falls back to `offline` without crashing API endpoints |

## Related Code Files

### Create
- `apps/project-service/src/modules/presence/presence.service.spec.ts`
- `apps/project-service/src/modules/presence/presence.controller.spec.ts`

### Modify
- None

## Implementation Steps

1. **Write Unit Tests for `PresenceService`**:
   - Mock `RedisService` (`setValue`, `getValue`, `sadd`, `smembers`, `srem`).
   - Test `recordHeartbeat`: assert Redis key format and TTL 60.
   - Test `getWorkspacePresence`: simulate both active and expired keys, verifying expired users are pruned from the workspace set.
   - Test `getPresenceStream`: verify that stream emits Observable values at specified intervals.
2. **Write Controller Tests**:
   - Verify `@Post('heartbeat')` calls service with user ID from JWT.
   - Verify `@Sse('stream')` correctly passes workspace ID to service stream method.
3. **Run Automated Test Suite**:
   ```bash
   pnpm --filter project-service test -- presence.service.spec.ts
   ```
4. **Live Verification Playbook**:
   - **Step 1: Check Heartbeat Endpoint**:
     ```bash
     curl -X POST http://localhost:3304/circle/api/presence/heartbeat \
       -H "Authorization: Bearer <TOKEN>" \
       -H "Content-Type: application/json" \
       -d '{"workspaceId":"test-ws","status":"online"}'
     ```
   - **Step 2: Check SSE Stream**:
     ```bash
     curl -N http://localhost:3304/circle/api/presence/stream?workspaceId=test-ws&token=<TOKEN>
     ```
     Verify formatted SSE output: `data: {"type":"presence:update","presence":{...}}`.
   - **Step 3: Multi-Tab & Multi-User Browser Test**:
     - Open User 1 in Chrome and User 2 in Incognito.
     - Navigate to `/[orgId]/members`.
     - Confirm User 1 sees User 2 as "Online" with green badge.
     - Leave User 2 idle for 5 minutes; verify User 1 sees User 2 transition to "Away".
     - Close User 2 tab; verify User 2 turns "Offline" within ~60s.
5. **Lint and Type Check Verification**:
   ```bash
   pnpm --filter project-service check-types
   pnpm --filter web lint
   ```

## Success Criteria

- [x] All unit tests in `presence.service.spec.ts` pass.
- [x] SSE stream outputs valid `text/event-stream` format with periodic updates.
- [x] Inactive users transition to `offline` accurately within 60s of last heartbeat.
- [x] No type check or linting regressions in `project-service` or `web`.

## Risk Assessment

- **Risk**: Redis restart causes all users to momentarily appear offline.
  - **Observable Signal**: Fleeting "offline" state across users.
  - **Mitigation**: Normal client heartbeats (every 25s) immediately repopulate Redis on the next cycle without requiring manual intervention.
