# Final Review Fix Report

## Scope

This fix wave addresses the two code findings from the final R0 PostgreSQL/local-development review. Compose files and PostgreSQL-backed integration behavior remain unchanged because the Docker daemon is unavailable in this environment.

## Migration failure output

- Added `apps/api/test/migrate.test.ts` before changing the runner.
- The RED run exercised `runMigrations` with an injected migration failure and failed because the runner ignored the test dependencies, attempted a real connection, and emitted no structured failure record.
- `runMigrations` now loads the migration journal and SQL, determines the pending migration tags from Drizzle's migration table, and maps a Drizzle failed-query error back to its concrete journal tag.
- Failure output is one JSON line with `event`, `migrationVersion`, `pendingVersions`, and `postgresResult`. The PostgreSQL result includes the available error name, message, severity, code, detail, hint, position, where, schema, table, column, and constraint fields.
- The runner emits the failure line before rethrowing the same error, so the command retains a rejected/nonzero failure path.
- The test replaces only the unavailable PostgreSQL/client and output boundaries. It verifies the concrete `0000_owners` tag, PostgreSQL error fields, single-line JSON output, and exact error propagation without Docker.

## Shutdown cleanup

- Added the server-close-error lifecycle test before changing the shutdown handler.
- The RED run showed `server.close()` rejection propagated while `pool.end()` was skipped.
- `createShutdownHandler` now awaits HTTP server closure in a `try` block and closes the process-owned pool in `finally`.
- Lifecycle coverage verifies normal ordering and verifies that a server-close error still closes the pool before the same server error propagates.

## TDD evidence

| Cycle | Command | Result |
| --- | --- | --- |
| Migration RED | `npm test -- --test-name-pattern='logs the failing migration'` | Failed because the existing runner attempted `postgresql://unused`; the injected failure/output boundary was not used. |
| Migration GREEN | `npm test -- --test-name-pattern='logs the failing migration'` | Passed, including structured output and exact propagation assertions. |
| Shutdown RED | `npm test -- --test-name-pattern='stopping the HTTP server fails'` | Failed because calls contained only `server closing`; `pool` was absent. |
| Shutdown GREEN | `npm test -- --test-name-pattern='stopping the HTTP server fails|database pool after the HTTP server'` | Passed both normal and server-error lifecycle paths. |

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Full API unit suite | `npm test` | 13 tests passed, 0 failed. |
| TypeScript build after type-boundary correction | `npm run build` | Completed successfully. |
| Patch formatting | `git diff --check` | Completed successfully. |

The first concurrent full verification run found that the migration test seam declared `connect()` as `Promise<void>` while `pg.Client.connect()` returns `Promise<Client>`. The boundary now accepts `Promise<unknown>`; the focused build then completed successfully. Final verification is rerun after this report is written and before commit.

## Environment constraint

No Docker Compose startup, migration application, PostgreSQL integration test, or live API health check was run in this fix wave. The Docker daemon remains unavailable. The focused failure-path test provides deterministic coverage without claiming a live PostgreSQL result.

## Commit scope

- `apps/api/src/db/migrate.ts`
- `apps/api/test/migrate.test.ts`
- `apps/api/src/server.ts`
- `apps/api/test/server.test.ts`
- `.superpowers/sdd/postgresql-local-development-plan/final-fix-report.md` is an ignored SDD handoff artifact and remains available in this worktree.
