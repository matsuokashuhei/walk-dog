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
| API unit tests | `cd apps/api && npm test` | 11 tests passed. |
| TypeScript build | `cd apps/api && npm run build` | Completed successfully. |
| Database migration | `docker compose -f apps/compose.yml up --build -d` and `docker compose -f apps/compose.yml logs migrate` | Blocked: Docker returned `Cannot connect to the Docker daemon at unix:///Users/matsuokashuhei/.docker/run/docker.sock. Is the docker daemon running?` |
| API health | `curl --include http://localhost:3000/health` | Pending: the API service requires the Compose startup flow to complete. |
| Integration tests | `docker compose -f apps/compose.yml run --rm migrate npm run test:integration` | Pending: the test runs through the Compose network after PostgreSQL is healthy. |
| Retry | Start Docker, run `cp apps/.env.example apps/.env.local`, then run `docker compose -f apps/compose.yml up --build -d`, `docker compose -f apps/compose.yml ps`, `curl --include http://localhost:3000/health`, `docker compose -f apps/compose.yml logs migrate`, and `docker compose -f apps/compose.yml down`. | Expected: migration logs include `{"appliedVersions":["0000_owners"]}` and API health returns HTTP 200 with `{ "status": "ok" }` plus `X-Request-Id`. |
