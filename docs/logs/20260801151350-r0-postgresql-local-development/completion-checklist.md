# R0 PostgreSQL local development completion checklist

## Deliverables

- [x] Compose provides PostgreSQL and the API in dependency order.
- [x] PostgreSQL exposes port 5432 and persists data in the `postgres-data` volume.
- [x] The API exposes port 3000 after PostgreSQL becomes healthy.
- [x] The local environment template provides PostgreSQL credentials, database URL, and pool size.

## Verification record

| Criterion | Command or request | Result |
| --- | --- | --- |
| Compose contract | `docker compose -f apps/compose.yml config` | Completed successfully. PostgreSQL includes `pg_isready`; API waits for PostgreSQL with `service_healthy`. |
| API unit tests | `cd apps/api && npm test` | 14 tests passed. |
| TypeScript build | `cd apps/api && npm run build` | Completed successfully. |
| API health | `curl --include http://localhost:3000/health` | Passed: HTTP 200, `{ "status": "ok" }`, and an `X-Request-Id` response header. |
| Retry | Start Docker, run `cp apps/.env.example apps/.env.local`, then run `docker compose -f apps/compose.yml up --build -d`, `docker compose -f apps/compose.yml ps`, `curl --include http://localhost:3000/health`, and `docker compose -f apps/compose.yml down`. | Completed successfully with the results recorded above. |
