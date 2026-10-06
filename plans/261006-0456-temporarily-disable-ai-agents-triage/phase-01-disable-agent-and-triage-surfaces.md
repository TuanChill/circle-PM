---
phase: 1
title: "Disable AI Agent and Triage surfaces"
status: pending
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1: Disable AI Agent and Triage surfaces

## Goal

Make AI Agent and Triage-specific product entry points unavailable throughout the web app and project service while retaining the underlying implementation and issue workflow contract for later restoration.

## Key Insights

- Workspace navigation already omits AI settings and Agent personalization, but their routes remain directly accessible.
- `/agent` remains reachable from a command-palette shortcut and the backend Agent controller remains registered.
- Triage also names a first-class issue status/category; removing that status would change issue and backlog behavior and is outside this temporary disablement.
- Team settings and the notification popover expose Triage-specific controls even though the inbox is not configured.

## Requirements

### Functional

- Block direct access to the Agent chat and AI settings/personalization routes (use the app's established unavailable/not-found behavior).
- Remove the Ask Agent command-palette shortcut and all workspace/team settings entry points for Agent functionality.
- Remove the dedicated Agents integration marketplace category and its Agent-specific entries. Keep AI client integrations and unrelated integrations.
- Unregister `AgentModule` from the project-service application so the Agent endpoints return not found while disabled.
- Remove the Triage inbox/settings control and the Triage queue notification setting.
- Remove the AI Agent marketing badge and feature card.

### Compatibility and Non-functional

- Do not remove Agent source files or alter persisted data, database schemas, or migrations.
- Preserve `triage` as a valid issue status/category, including its existing backlog and filter behavior.
- Keep each disabled surface easy to restore by re-registering routes/module and restoring UI entries.
- Update maintainer documentation to match the disabled state and identify the preserved workflow status.

## Architecture

Disable access at the owning registration points: block the Next.js routes, remove web navigation/settings/marketing entries, and omit `AgentModule` from the Nest application module. Leave feature implementation modules and data intact. Triage status/category definitions remain registered in the issue workflow.

## Related Code Files

### Modify

- `apps/web/app/[orgId]/agent/page.tsx`
- `apps/web/app/[orgId]/settings/ai/page.tsx`
- `apps/web/app/[orgId]/settings/agent-personalization/page.tsx`
- `apps/web/components/layout/command-palette.tsx`
- `apps/web/components/common/settings/team-settings.tsx`
- `apps/web/components/common/settings/integrations-data.ts`
- `apps/web/components/layout/headers/issues/notifications.tsx`
- `apps/web/components/marketing/features-section.tsx`
- `apps/web/components/marketing/hero-section.tsx`
- `apps/project-service/src/modules/app.module.ts`
- `apps/web/AI_GUIDE.md`
- `docs/linear-parity-audit.md`

### Create / Delete

- None. Keep Agent implementation files in place for re-enablement.

## Implementation Steps

1. Confirm direct-route behavior for disabled features and use the established not-found/unavailable pattern for `/agent`, `/settings/ai`, and `/settings/agent-personalization`.
2. Remove Agent command-palette access, team/workspace controls, dedicated Agent integration listings, and AI Agent marketing claims.
3. Remove the unavailable Triage inbox row and Triage queue notification option from team settings and issue notifications.
4. Omit `AgentModule` from `AppModule`; retain the module and service source without registering controllers.
5. Update the AI guide and parity audit to state that Agent features are temporarily disabled and that issue `triage` status remains supported.
6. Verify no active UI links or registered HTTP endpoints expose the disabled Agent/Triage-specific features, while issue triage workflow paths remain intact.

## Todo

- [ ] Disable direct Agent and AI settings routes.
- [ ] Remove Agent and Triage-specific UI entry points and marketing claims.
- [ ] Unregister the Agent API module.
- [ ] Update maintainer documentation.
- [ ] Verify disabled surfaces and preserved issue triage workflow.

## Success Criteria

- Web build succeeds and direct navigation to each disabled route follows the chosen unavailable/not-found behavior.
- Project-service tests and type checking pass; requests to `/agent/chat` and `/agent/examples` return 404 because no controller is registered.
- Search and browser smoke confirm no visible Agent/Triage-specific entry points remain; AI client integrations and generic issue triage workflow are unaffected.
- No schema migration or persisted-data change is introduced.

## Risk Assessment

- **Risk:** Hiding only navigation leaves disabled pages reachable by URL.
  - **Mitigation:** Block route access and verify direct navigation.
- **Risk:** Broad text replacement removes the issue workflow's `triage` status.
  - **Mitigation:** Limit changes to Agent/Triage feature surfaces; verify backlog, filter, and status definitions remain intact.
- **Risk:** The Agent endpoint stays public after removing the page.
  - **Mitigation:** Unregister `AgentModule` and verify both route paths return 404.

## Security Considerations

- Disabled Agent endpoints must not remain callable through direct API requests. No authentication or persisted-data contract is otherwise changed.

## Next Steps

- Re-enable later by restoring route access, UI entries, and `AgentModule` registration; no migration or data restoration should be needed.
