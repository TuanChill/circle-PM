---
name: project-monorepo-structure
description: nest-turbo-starter package names, check-types/build script conventions, and shared-lib runtime resolution gotcha
metadata:
  type: project
---

Monorepo has `apps/{auth-service,user-service,notification-service,project-service,mcp-server,web}` and `libs/{common,core,email-template}`. pnpm filter names: apps use bare name (`auth-service`, `mcp-server`, etc.), libs use scoped name (`@app/common`, `@app/core`).

Apps expose `check-types` (`tsc --noEmit -p tsconfig.build.json`) and `build` (`nest build` via SWC) scripts. Libs (`@app/common`, `@app/core`) have NO `check-types` script — only `build` (`tsc -p tsconfig.json`), so use `pnpm --filter @app/common build` to typecheck them.

**Why:** `libs/common` and `libs/core` resolve at runtime via their `package.json` `"main": "dist/index.js"` field, not live TS source — every consumer app (auth-service, user-service, notification-service, project-service, mcp-server) reads compiled `dist/`. If `dist/` goes stale relative to `src/`, consumers can fail to boot with confusing runtime errors (e.g. a bogus Joi config-validation error) even though `src/` and type-checks are fine.

**How to apply:** After any change to `libs/common` or `libs/core` source, rebuild both (`pnpm --filter @app/common build && pnpm --filter @app/core build`) before testing any consumer app — a consumer boot failure right after a lib change is a strong signal of stale dist, not a real regression. When verifying such a change, check-types/build across ALL consumer apps, not just the one initially reported broken.
