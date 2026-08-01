# R0 PostgreSQL local development completion checklist

## Deliverables

- [x] Compose provides PostgreSQL, a one-shot migration service, and the API in dependency order.
- [x] PostgreSQL exposes port 5432 and persists data in the `postgres-data` volume.
- [x] The API exposes port 3000 after migration completes successfully.
- [x] The local environment template provides PostgreSQL credentials, database URL, and pool size.

## Verification record

| Criterion | Command or request | Result |
| --- | --- | --- |
| Compose contract | `docker compose -f apps/compose.yml config` | Completed successfully. PostgreSQL includes `pg_isready`; API waits for `migrate` with `service_completed_successfully`. |
| API unit tests | `cd apps/api && npm test` | 12 tests passed. |
| TypeScript build | `cd apps/api && npm run build` | Completed successfully. |
| Database migration | `docker compose -f apps/compose.yml up --build -d` and `docker compose -f apps/compose.yml ps -a` | Passed: `apps-migrate-1` exited with code 0; logs show `drizzle-kit migrate` using the PostgreSQL driver. |
| API health | `curl --include http://localhost:3000/health` | Passed: HTTP 200, `{ "status": "ok" }`, and an `X-Request-Id` response header. |
| Integration tests | `docker compose -f apps/compose.yml run --rm migrate npm run test:integration` | Passed: 1 test passed; duplicate `cognito_subject` was rejected by PostgreSQL uniqueness. |
| Retry | Start Docker, run `cp apps/.env.example apps/.env.local`, then run `docker compose -f apps/compose.yml up --build -d`, `docker compose -f apps/compose.yml ps`, `curl --include http://localhost:3000/health`, `docker compose -f apps/compose.yml logs migrate`, and `docker compose -f apps/compose.yml down`. | Completed successfully with the results recorded above. |
