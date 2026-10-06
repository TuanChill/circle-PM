---
name: nest-turbo-starter-repo-facts
description: Repo-specific tooling facts for nest-turbo-starter useful across reviews (lint tool, winston pattern, http client)
metadata:
  type: project
---

- Linter is **oxlint** (`pnpm --filter <app> lint` runs `oxlint .`), not eslint directly — run this
  to verify lint claims rather than assuming.
- Winston usage convention (NestJS apps here): DI-injected `@Inject(WINSTON_MODULE_PROVIDER) logger: Logger`
  (raw `winston.Logger` type) must use level-specific methods (`.info`/`.warn`/`.error`) — raw Winston's
  `.log()` requires an explicit `level` field and is a real footgun. The separate NestJS `LoggerService`
  obtained via `WinstonModule.createLogger(...)` (used for framework/bootstrap logging, e.g. `main.ts`)
  is a different wrapper whose `.log()` is safe/normal to call — don't conflate the two when checking
  for bare `.log()` violations; check the import (`from 'winston'` vs the Nest wrapper) and injection
  token first.
- `libs/core/src/http/http.service.ts` (`HttpService`) wraps raw axios generically (get/post/patch/put/delete
  all accept `(url, data?, config?)` with a `params` config key for query strings). Consumers that build a
  narrower wrapper (e.g. `apps/mcp-server`'s `ProjectServiceHttpClient`) may expose only `(path, body)` for
  non-GET verbs — check the narrower wrapper's actual signature before assuming query params are supported
  on PATCH/POST/PUT/DELETE; they may need to be inlined into the path string with `encodeURIComponent`
  instead.
