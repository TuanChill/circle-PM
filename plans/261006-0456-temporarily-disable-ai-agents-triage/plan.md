---
title: "Temporarily Disable AI Agents and Triage"
description: "Remove access to AI Agents and Triage surfaces while preserving issue triage status and existing data for a later re-enable."
status: in_progress
priority: P2
effort: "0.5d"
tags: [web, backend, ai-agents, triage]
created: 2026-10-06
---

# Temporarily Disable AI Agents and Triage

## Overview

Temporarily disable the AI Agent and Triage product surfaces across the web app and project service. Keep their implementation and persisted data so the feature can be restored, and keep `triage` as an issue workflow category/status used by backlog and filters.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Remove visible and direct access to AI Agent, AI settings, and Triage-specific controls. | P1 |
| 2 | Stop exposing Agent HTTP endpoints while disabled. | P1 |
| 3 | Preserve issue workflow status `triage`, existing issues, and database schema. | P1 |
| 4 | Make re-enabling possible by restoring route/module registrations and UI entry points. | P2 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Disable AI Agent and Triage surfaces](./phase-01-disable-agent-and-triage-surfaces.md) | In Progress |

## Success Criteria

- [ ] Agent chat, Agent settings/personalization, Agent command-palette entry, and the dedicated Agents integration category are inaccessible or absent.
- [ ] Team settings no longer show Agent controls, unavailable Triage inbox control, or the Triage workflow-settings group; the Triage queue notification control is removed.
- [ ] Marketing no longer advertises an AI Agent feature.
- [ ] Project-service `/agent/chat` and `/agent/examples` endpoints are not registered while disabled.
- [ ] Existing issue `triage` status/category, backlog membership, filters, records, and schemas remain unchanged.
- [ ] Focused web/backend checks pass, and maintainer documentation describes the temporary disablement.

## Scope

### Included

- Disable the Agent route and settings routes, remove Agent entry points, disable its backend controller registration, and remove dedicated Agent integration listings.
- Remove the unsupported Triage inbox/settings group and notification entry points.
- Update AI Agent marketing claims and affected maintainer documentation.
- Preserve code, data, and migrations required to re-enable the feature.

### Excluded

- Removing the `triage` workflow status/category or changing issue/backlog/filter behavior.
- Removing unrelated AI client integrations, third-party integrations, or generic issue triage workflow language.
- Deleting Agent implementation files, stored conversations, or database structures.

## Key Evidence

- The web Agent page and AI settings routes exist under `apps/web/app/[orgId]`, although workspace navigation entries are currently commented out.
- `AgentModule` is registered in `apps/project-service/src/modules/app.module.ts` and exposes `/agent/chat` and `/agent/examples`.
- Team settings contains unavailable Triage inbox and Agent rows; issue notifications contain a Triage queue option.
- The issue workflow uses `triage` in status definitions, backlog categories, and filters, so that contract is preserved.

## Dependencies

- None.

<!-- slug: temporarily-disable-ai-agents-triage -->
