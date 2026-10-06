---
phase: 1
title: "Backend Presence Service & SSE Stream"
status: completed
priority: P1
effort: "5h"
dependencies: []
---

# Phase 1: Backend Presence Service & SSE Stream

## Overview

Build the core presence tracking engine inside `project-service` using Redis for ephemeral TTL storage and NestJS SSE (`@Sse()`) for broadcasting presence updates.

## Requirements

### Functional
- `POST /circle/api/presence/heartbeat`:
  - Payload: `{ status: 'online' | 'away', workspaceId: string }`.
  - Authenticated via JWT (`@User('id')`).
  - Sets Redis key `presence:user:{userId}` with 60-second TTL.
  - Tracks member in workspace user set `presence:workspace:{workspaceId}:users`.
- `GET /circle/api/presence/stream`:
  - Server-Sent Events stream using NestJS `@Sse()`.
  - Accepts JWT via Bearer token or `?token=` query parameter (needed for browser `EventSource`).
  - Emits presence state every 10 seconds (or on state change) for all members of the requested workspace.
  - Prunes expired users from the workspace set when Redis keys expire.
- `GET /circle/api/presence/workspace/:workspaceId`:
  - Returns current presence map for all members in the workspace: `{ [memberId: string]: 'online' | 'away' | 'offline' }`.
- Integration with Members API:
  - In `MembersService.findAll()`, overlay real-time status from Redis onto the member list before returning to client.

### Non-functional
- Zero database write traffic on heartbeats (all state lives in Redis).
- Graceful degradation: if Redis is temporarily unreachable, default status to `offline` without crashing requests.
- Automatic key cleanup via Redis TTL (60s).

## Architecture

### Redis Data Structures
1. **User Key (String with TTL)**:
   - Key: `presence:user:{userId}`
   - Value: `{"status":"online"|"away","lastSeen":1727950000000,"workspaceId":"ws_123"}`
   - TTL: 60 seconds
2. **Workspace Active Users (Set)**:
   - Key: `presence:workspace:{workspaceId}:users`
   - Members: `userId`
   - Cleaned up lazily when `MGET` returns null for expired keys.

### Authentication for SSE
Browser `EventSource` does not support custom request headers. We update `JwtStrategy` in `project-service` to extract JWT tokens from both:
1. `Authorization: Bearer <token>`
2. Query parameter `?token=<token>`

## Related Code Files

### Create
- `apps/project-service/src/modules/presence/presence.module.ts`
- `apps/project-service/src/modules/presence/presence.service.ts`
- `apps/project-service/src/modules/presence/presence.controller.ts`
- `apps/project-service/src/modules/presence/dto/heartbeat.dto.ts`
- `apps/project-service/src/modules/presence/presence.constants.ts`
- `apps/project-service/src/modules/presence/presence.service.spec.ts`
- `apps/project-service/src/modules/presence/presence.controller.spec.ts`

### Modify
- `apps/project-service/src/modules/app.module.ts` (import `RedisModule` and `PresenceModule`)
- `apps/project-service/src/modules/auth/strategies/jwt.strategy.ts` (support token from query params)
- `apps/project-service/src/modules/members/members.module.ts` (import `PresenceModule`)
- `apps/project-service/src/modules/members/members.service.ts` (overlay Redis status in `findAll` and `findOne`)

## Implementation Steps

1. **Enable RedisModule & Update JWT Strategy**:
   - Import `RedisModule` from `@app/core` into `AppModule` of `project-service`.
   - Update `JwtStrategy` in `project-service` using `ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), ExtractJwt.fromUrlQueryParameter('token')])`.
2. **Create Heartbeat DTO & Validation**:
   - Define `HeartbeatDto` with `@IsIn(['online', 'away'])` and `@IsString() workspaceId`.
3. **Implement `PresenceService`**:
   - `recordHeartbeat(userId: string, dto: HeartbeatDto): Promise<void>`
   - `getWorkspacePresence(workspaceId: string): Promise<Record<string, 'online' | 'away' | 'offline'>>`
   - `getPresenceStream(workspaceId: string): Observable<MessageEvent>` using RxJS `interval(10000)` and `switchMap`.
4. **Implement `PresenceController`**:
   - Decorate with `@Controller('presence')`, `@UseGuards(JwtAuthGuard)`.
   - Add `@Post('heartbeat')` endpoint.
   - Add `@Sse('stream')` endpoint returning stream of presence data.
   - Add `@Get('workspace/:workspaceId')` snapshot endpoint.
5. **Overlay Presence in MembersService**:
   - Inject `PresenceService` into `MembersService`.
   - In `findAll()`, fetch workspace presence map and set `member.status = presenceMap[member.id] || 'offline'`.

## Success Criteria

- [x] Unit tests for `PresenceService` pass with mock Redis client.
- [x] Calling `POST /circle/api/presence/heartbeat` creates Redis key with 60s TTL.
- [x] Calling `GET /circle/api/presence/stream?token=...&workspaceId=...` streams SSE event frames containing workspace member statuses.
- [x] When Redis key expires, subsequent stream frame marks member as `offline` and prunes ID from workspace set.

## Risk Assessment

- **Risk**: High frequency of SSE intervals could saturate Redis MGET commands.
  - **Observable Signal**: High Redis CPU usage or latency spikes.
  - **Mitigation**: Cache workspace presence snapshot in memory with 5-second TTL in `PresenceService` before re-querying Redis, or scale interval to 15s.
- **Risk**: SSE connection leak when clients disconnect abruptly.
  - **Observable Signal**: Growing open file descriptors / memory on project-service.
  - **Mitigation**: Ensure RxJS observable cleans up interval subscription on client disconnect (`takeUntil(fromEvent(req, 'close'))`).
