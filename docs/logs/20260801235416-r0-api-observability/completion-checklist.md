# R0 API Observability Completion Checklist

## Deliverables

- [x] API config loads `ENVIRONMENT`, `RELEASE`, and optional `SENTRY_DSN`.
- [x] Pino JSON logs include service, environment, release, requestId, method, route, status, and duration.
- [x] Sentry initializes from DSN when present and captures handler errors with requestId tags.
- [x] Common middleware provides request ID, secure headers, Pino logging, and Sentry context.
- [x] Shutdown closes the HTTP server, PostgreSQL pool, and Sentry.
- [x] Empty `SENTRY_DSN` disables Sentry for local development.

## Verification record

| Criterion | Command or request | Result |
| --- | --- | --- |
| API unit tests | `cd apps/api && npm test` | 21 tests passed. |
| TypeScript build | `cd apps/api && npm run build` | Completed successfully. |
| Structured log correlation | Observability test `writes a structured HTTP completion log with requestId correlation` | Passed with shared requestId and HTTP fields. |
| Sentry capture path | Observability test `captures thrown errors through the Sentry bridge` | Passed. |
| Secure headers | Observability test `responses include secure headers` | Passed: `X-Content-Type-Options: nosniff`. |
| Shutdown order | Server tests for pool and Sentry close | Passed. |
