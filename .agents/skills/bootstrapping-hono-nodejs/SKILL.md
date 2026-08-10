---
name: bootstrapping-hono-nodejs
description: Bootstrap or reconfigure a Hono Node.js API package, including create-hono, the Node adapter, serve entrypoint, app factory separation, and package scripts. Use when initializing apps/api or changing Node.js runtime startup. Do not use for route handlers, middleware composition, validation, OpenAPI schemas, or tests alone.
---

# Bootstrapping Hono Node.js

Read the current official Hono Node.js docs before changing package bootstrap or runtime startup. Runtime is Node.js only.

## Required documentation review

1. Open <https://hono.dev/docs/getting-started/nodejs> before changing Node adapter or server startup.
2. Read <https://hono.dev/docs/guides/create-hono> when using or adjusting `create-hono`.
3. Record the documentation URLs read and the bootstrap decision in the active session log, design, or pull request description.

## Project defaults

- Place the API package in `apps/api`.
- Keep `src/app.ts` as an application factory. Keep `src/index.ts` as the Node.js entry that serves the factory result with `@hono/node-server`.
- Tests import the factory without starting a Node.js listener (`$hono:testing-hono-apis`).
- Package scripts:
  - `dev`: `tsx watch src/index.ts`
  - `build`: TypeScript compilation that writes production output to `dist`
  - `start`: `node dist/index.js`

## Node.js initialization

After the official docs review, initialize the first Node.js API with this sequence:

1. Run `cd apps/api`.
2. Run `npm create hono@latest .`.
3. Select the Node.js template and npm for dependency installation.
4. Define the package scripts listed above.
5. Keep the factory / entry separation.
6. Define the first public contract before extending the API: `GET /health`, `GET /openapi.json`, a request ID on each response, and JSON error responses with status, message, request ID, and retryable.
7. Add contract tests for health, OpenAPI, request ID, and error responses (`$hono:testing-hono-apis`).
8. Wire OpenAPI with `$hono:documenting-hono-openapi` and shared middleware with `$hono:composing-hono-middleware`.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The Node.js adapter docs and create-hono docs read. |
| Design | Package location, scripts, factory/entry boundary, and first public contract. |
| Implementation | Focused bootstrap and startup changes that follow the reviewed documentation. |
| Verification | Typecheck, package scripts, and contract tests via `$hono:testing-hono-apis`. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| New Node.js API | Node.js getting-started and create-hono | Template, scripts, factory/entry paths |
| Dev or start command | Node.js getting-started | Script commands and entry file |
| Listener vs testable app | Node.js getting-started | Factory export and serve call site |
| First public endpoints | Project API design | `/health`, `/openapi.json`, request ID, error JSON |

## Completion check

Before reporting a bootstrap change complete, provide the documentation reviewed, the package and entry boundary changed, and the verification results.
