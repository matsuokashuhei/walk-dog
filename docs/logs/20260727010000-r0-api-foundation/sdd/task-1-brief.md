# Task 1 Brief

Plan: `docs/development/2026-07-27-r0-api-foundation-first-unit-plan.md`

## Goal

Provide `createApp(registerRoutes?: (app: App) => void): App` and `GET /health` with HTTP 200 and `{ "status": "ok" }`.

## Files

- `apps/api/src/app.ts`
- `apps/api/src/index.ts`
- `apps/api/test/app.test.ts`
- `apps/api/package.json`
- `apps/api/tsconfig.json`

## Verification

- Add the `tsx --test test/**/*.test.ts` command.
- Run the health contract test first and record its failure before the application implementation.
- Install `@hono/zod-openapi` and `zod`.
- Run the health test and `npm run build` after implementation.
- Exclude `test` from the production TypeScript build input.
