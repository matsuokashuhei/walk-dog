# R0 API Observability Completion Checklist

## Deliverables

- [x] API config loads `ENVIRONMENT`, `RELEASE`, and optional `SENTRY_DSN`.
- [x] Pino JSON logs include service, environment, release, requestId, method, route, status, and duration.
- [x] Request-scoped child logger is available on the Hono context via `@hono/structured-logger`.
- [x] `@sentry/hono` initializes from `instrument.ts` via `--import` when DSN is present.
- [x] `requestId` is set on the Sentry isolation scope.
- [x] Common middleware provides request ID, secure headers, structured logging, and Sentry context.
- [x] Shutdown closes the HTTP server, PostgreSQL pool, and Sentry.
- [x] Empty `SENTRY_DSN` skips Sentry initialization for local development.

## Verification record

| Criterion | Command or request | Result |
| --- | --- | --- |
| API unit tests | `cd apps/api && npm test` | 22 tests passed. |
| TypeScript build | `cd apps/api && npm run build` | Completed successfully. |
| Structured log correlation | Observability test for HTTP completion log | Passed with shared requestId and HTTP fields. |
| Child logger | Observability test for context logger bindings | Passed. |
| Isolation scope requestId | Observability test for setRequestId binding | Passed. |
| Secure headers | Observability test for `X-Content-Type-Options` | Passed. |
| Shutdown order | Server tests for pool and Sentry close | Passed. |
