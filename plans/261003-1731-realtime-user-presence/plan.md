---
title: "Real-time User Presence (Online Status)"
description: "Implement real-time user presence tracking (online, away, offline) using Redis TTL heartbeat and Server-Sent Events (SSE) stream, replacing static mock status across the member list and profile views."
status: completed
priority: P1
effort: "1.5d"
tags: [presence, realtime, sse, redis, members]
created: 2026-10-03
---

# Real-time User Presence (Online Status)

## Overview

Currently, member presence status (`online`, `offline`, `away`) displayed in the members table (`MemberLine`) and profile drawer (`MemberProfile`) is static mock data seeded in PostgreSQL. There is no active heartbeat or real-time notification mechanism.

This plan implements **Option A: Redis Presence + Server-Sent Events (SSE)**:
1. Active frontend clients emit a heartbeat every 25–30s to `project-service`.
2. Backend records presence in Redis with a 60s TTL (`presence:user:{userId}` -> `{ status, lastSeen, workspaceId }`) and tracks active user IDs per workspace in a Redis Set.
3. Idle detection (5 minutes without user interaction or tab hidden) switches status to `away`.
4. SSE stream (`GET /circle/api/presence/stream?workspaceId=...`) broadcasts presence diffs to connected workspace members every 10s.
5. Frontend maintains a lightweight Zustand presence store to dynamically update presence badges and indicators across all UI components without database writes on heartbeat.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Ephemeral presence storage in Redis with automatic TTL expiration (zero DB writes on heartbeat) | P1 |
| 2 | SSE streaming endpoint in `project-service` pushing presence delta to workspace subscribers | P1 |
| 3 | Client heartbeat hook with activity listener (mouse, keyboard, focus) & 5-min idle `away` transition | P1 |
| 4 | Reactive Zustand store in Next.js web app updating `member-line` & `member-profile` badges in real time | P1 |
| 5 | Graceful fallback to `offline` if Redis or SSE connection drops | P2 |

## System Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │               Next.js Web App                │
                    │                                              │
                    │  ┌──────────────────┐  ┌──────────────────┐  │
                    │  │usePresenceHeart- │  │ usePresence-     │  │
                    │  │beat (every 30s)  │  │ Stream (SSE)     │  │
                    │  └────────┬─────────┘  └────────▲─────────┘  │
                    │           │                     │            │
                    │           │                     │            │
                    │           │             ┌───────┴─────────┐  │
                    │           │             │usePresenceStore │  │
                    │           │             │ (Zustand)       │  │
                    │           │             └───────┬─────────┘  │
                    │           │                     │ (state)    │
                    │           │             ┌───────▼─────────┐  │
                    │           │             │MemberLine /     │  │
                    │           │             │MemberProfile UI │  │
                    │           │             └─────────────────┘  │
                    └───────────┼─────────────────────▲────────────┘
                                │ POST                │ SSE stream
                                │ heartbeat           │ (every 10s diff)
                                ▼                     │
                    ┌─────────────────────────────────┴────────────┐
                    │          project-service (NestJS)            │
                    │                                              │
                    │  ┌────────────────────────────────────────┐  │
                    │  │            PresenceService             │  │
                    │  └──────────────────┬─────────────────────┘  │
                    └─────────────────────┼────────────────────────┘
                                          │
                                          ▼
                    ┌──────────────────────────────────────────────┐
                    │                 Redis 7                      │
                    │  Key: `presence:user:{id}` (TTL: 60s)        │
                    │  Set: `presence:workspace:{wsId}:users`      │
                    └──────────────────────────────────────────────┘
```

## Phases

| # | Phase | Priority | Effort | Status |
|---|-------|----------|--------|--------|
| 1 | [Phase 1: Backend Presence Service & SSE Stream](./phase-01-backend-presence-service.md) | P1 | 5h | Completed |
| 2 | [Phase 2: Frontend Heartbeat & Idle Detection Hook](./phase-02-frontend-heartbeat-idle.md) | P1 | 3h | Completed |
| 3 | [Phase 3: Frontend Real-time Presence UI & Store](./phase-03-frontend-presence-ui.md) | P1 | 3h | Completed |
| 4 | [Phase 4: Testing, Error Handling & Verification](./phase-04-testing-and-verification.md) | P2 | 3h | Completed |

## Success Criteria

- [x] `POST /circle/api/presence/heartbeat` writes presence record with 60s TTL in Redis.
- [x] `GET /circle/api/presence/stream` emits SSE events with online member states for the requester's workspace.
- [x] User status automatically updates to `away` after 5 minutes of inactivity (no mouse, keyboard, or tab blur).
- [x] Member list (`member-line.tsx`) and profile drawer (`member-profile.tsx`) show live green indicator without page refresh.
- [x] Member status switches to `offline` within ~60s after tab closure (key TTL expiry).
- [x] Zero PostgreSQL disk writes during active user presence heartbeats.

<!-- slug: realtime-user-presence -->