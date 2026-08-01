# R0 PostgreSQL final fix report

## Session record

The final review fix record is kept in this session directory under `docs/logs/`.

## Migration command decision

The migration service uses the standard Drizzle Kit command:

- `apps/api/package.json` defines `npm run migrate` as `drizzle-kit migrate`.
- `apps/api/drizzle.config.ts` supplies PostgreSQL credentials from `DATABASE_URL`.
- `apps/api/src/db/migrate.ts` and its dedicated test were removed because the standard command applies the generated SQL migration.
- The integration test checks the migrated `owners` table and its `cognito_subject` uniqueness constraint.

## Verification

- `npm test` passed 12 tests.
- `npm run build` completed successfully.
- `npm run db:generate` completed with no schema changes.
- Compose ran `drizzle-kit migrate` in the one-shot migration service and exited with code 0 before the API.
- The API health check returned HTTP 200 and the PostgreSQL integration test passed.
