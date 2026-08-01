# Specification Review

## Status

- Status: `ready`
- Purpose: Add R0 API observability with Pino structured logs and Sentry, correlated by requestId
- Active release: R0
- Next permitted action: design

## Source map

| Source | Confirmed use |
| --- | --- |
| `docs/development/staged-development.md` — 承認済みの判断; R0 | R0 provides Sentry and correlation-aware structured logs for API state transitions. |
| `docs/specs/2026-07-26-hono-api-r0-design.md` — 観測性; Dockerと設定 | Pino JSON logs with timestamp, level, service, environment, release, requestId; HTTP method, route, status, duration; Sentry correlated by requestId; common middleware includes request ID, secure headers, Pino logging, Sentry context; config validates environment, release, Sentry DSN; shutdown closes Sentry. |
| `docs/logs/20260726141518-decide-and-execute-development/transcript.md` — decision 5 | User confirmed Pino as JSON structured logger; request ID shared across response, logs, and Sentry; middleware order includes request ID, secure headers, Pino, Sentry context. |
| `docs/specs/2026-07-27-r0-api-foundation-first-unit.md` | Existing request ID and error contract remain the HTTP foundation this session extends. |
| `apps/api/src/app.ts`, `apps/api/src/config.ts`, `apps/api/src/server.ts` | Request ID middleware exists; Pino and Sentry are absent; config currently covers database only; shutdown closes HTTP server and PostgreSQL pool. |
| `docs/specs/external-specification.html` | Declares Markdown in the same directory as primary; does not define Sentry or Pino. Footer path `docs/external-specification/*.md` is absent. For this purpose, `docs/specs/2026-07-26-hono-api-r0-design.md` supplies the observability contract. |

## Current release deliverables

- API process emits Pino JSON structured logs to stdout with timestamp, level, service, environment, release, and requestId.
- HTTP request completion logs include method, route, status, and duration.
- API initializes Sentry from configuration and associates Sentry events with requestId.
- Common middleware provides request ID, secure headers, Pino logging, and Sentry context.
- Configuration validates environment, release, and Sentry DSN alongside existing database settings.
- SIGINT and SIGTERM shutdown flush or close Sentry after stopping the HTTP server and database pool.
- Existing health, OpenAPI, request ID, and error contracts continue to pass automated tests.

## Acceptance conditions

- `npm test` passes, including existing contract tests and new observability assertions.
- `npm run build` completes successfully.
- Log records for a request include the shared requestId fields named above.
- Sentry initialization accepts an empty or absent DSN as a disabled state for local development.

## Decision classification

| Decision | Classification |
| --- | --- |
| Scope limited to the API process (worker observability later) | Deferred release decision — remaining R0 worker work; worker process is not present yet. |
| Owner identifier fields on authenticated logs | Deferred — requires Cognito authentication (later R0 / R1 auth). |
| body-limit, CORS, Cognito, AWS clients, ECR, mobile | Outside this session purpose; remain later R0 or other work. |
| Extend existing `apps/api/src/config.ts` rather than immediately creating `src/config/env.ts` | Implementation-local — design path name differs; current package already uses `config.ts`. |
| Empty `SENTRY_DSN` disables Sentry in local development | Implementation-local — matches local Compose without a Sentry project. |
| `owners` table wording in R0 design vs completed PostgreSQL session | Outside this purpose — no schema change in this session; prior session removed owners from staged plan after review. |
| Missing `docs/external-specification/*.md` | Outside this purpose for observability; R0 design Markdown in `docs/specs/` is the product contract used here. No staged-plan change. |

## Plan-level decisions awaiting confirmation

None for this purpose.

## Next permitted action

design
