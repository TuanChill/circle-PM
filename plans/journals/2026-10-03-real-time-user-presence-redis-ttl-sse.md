---
title: Real-time User Presence (Redis TTL + SSE)
date: 2026-10-03
summary: "Implement real-time user online/away/offline presence with Redis TTL heartbeats, NestJS SSE stream, and Zustand store updating member list and profile UI."
---

# Real-time User Presence (Redis TTL + SSE)

Implement real-time user online/away/offline presence with Redis TTL heartbeats, NestJS SSE stream, and Zustand store updating member list and profile UI.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Problem
Member presence status (`online`, `away`, `offline`) in the members list and profile views was previously static mock data seeded in PostgreSQL. There was no real-time presence tracking or update mechanism.

## Solution Implemented (Option A: Redis + SSE)
1. **Backend (`project-service`)**:
   - `PresenceModule` & `PresenceService`: Records user heartbeats in Redis with 60s TTL (`presence:user:{userId}`) and manages active user set per workspace (`presence:workspace:{workspaceId}:users`).
   - `PresenceController`:
     - `POST /circle/api/presence/heartbeat` (authenticated, updates Redis key and set).
     - `GET /circle/api/presence/stream` (SSE stream emitting presence delta to workspace subscribers every 10s).
     - `GET /circle/api/presence/workspace/:workspaceId` (snapshot endpoint).
   - `JwtStrategy`: Updated to extract token from query param `?token=` in addition to `Authorization: Bearer` to support native browser `EventSource`.
   - `MembersService`: Overlaid live Redis presence in `findAll` and `findOne`.
2. **Frontend (`web`)**:
   - `presence.service.ts`: Client API methods for heartbeat and workspace presence snapshot.
   - `usePresenceStore.ts`: Zustand store caching presence states with zero re-renders on unaffected members.
   - `use-presence-heartbeat.ts`: Automatic 25s heartbeat loop with throttled user input listeners (mouse, keys, scroll) and 5-minute idle `away` transition.
   - `use-presence-stream.ts`: EventSource client subscribing to SSE with auto-reconnect.
   - `PresenceProvider.tsx`: Lifecycle wrapper mounted in `[orgId]/layout.tsx`.
   - `MemberLine.tsx` & `MemberProfile.tsx`: Subscribed to live presence store, displaying live green/away indicators without page reloads.

## Verification
- Unit test suites in `project-service` for `PresenceService` and `PresenceController` (100% pass, 16/16 tests).
- Monorepo type checks (`tsc --noEmit`) and linting (`next lint`) passing cleanly without regressions.
