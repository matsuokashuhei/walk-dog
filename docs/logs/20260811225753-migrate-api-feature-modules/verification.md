# Verification

## Task 1 Step 1 baseline (before moves)

Commands from `apps/api`:

- `npm test` → `tests 45`, `pass 45`, `fail 0`
- `npm run check` → lint, jscpd, knip, typecheck exit 0

### Baseline test names (45)

1. GET /health returns the API health state
2. GET /health generates a non-empty request ID when none is received
3. GET /openapi.json describes the health endpoint and error schema
4. uses a received request ID for the health response
5. returns the error contract for an unknown path
6. returns the error contract when a route throws
7. creates a Cognito client with provided config
8. loads POSTGRES_* and defaults DATABASE_POOL_MAX to 10
9. loads an explicit DATABASE_POOL_MAX
10. rejects a missing POSTGRES_USER
11. rejects a missing POSTGRES_HOST
12. rejects a missing POSTGRES_PORT
13. rejects a non-positive POSTGRES_PORT
14. loads ENVIRONMENT, RELEASE, and an empty SENTRY_DSN as disabled
15. loads a SENTRY_DSN when provided
16. rejects a missing ENVIRONMENT
17. rejects a missing RELEASE
18. loads Cognito configuration
19. rejects missing AWS_REGION
20. rejects missing COGNITO_USER_POOL_ID
21. rejects missing COGNITO_CLIENT_ID
22. writes a structured HTTP completion log with requestId correlation
23. exposes a request-scoped child logger on the Hono context
24. binds requestId on the Sentry isolation path
25. responses include secure headers
26. owners table has the expected columns
27. owners cognitoSubject is not null
28. closes the database pool and Sentry after the HTTP server has stopped
29. closes the database pool and Sentry when stopping the HTTP server fails
30. POST /v1/auth/sign-in/verify returns 400 for an empty OTP
31. POST /v1/auth/sign-in/verify returns tokens for a valid OTP
32. POST /v1/auth/sign-in/verify returns CODE_EXPIRED for an expired OTP
33. POST /v1/auth/sign-in/verify tells the user to resend after an invalid challenge session
34. POST /v1/auth/sign-in returns 400 for an invalid email
35. POST /v1/auth/sign-in returns an email OTP challenge
36. POST /v1/auth/sign-in returns 429 when Cognito rate limits the challenge
37. POST /v1/auth/sign-up/verify returns 400 for an empty verification code
38. POST /v1/auth/sign-up/verify returns tokens for a valid code
39. POST /v1/auth/sign-up/verify returns 400 for an invalid code
40. POST /v1/auth/sign-up/verify returns 409 for an already confirmed user
41. POST /v1/auth/sign-up returns 200 with session for valid email
42. POST /v1/auth/sign-up returns 409 for an existing confirmed user
43. POST /v1/auth/sign-up resends OTP for an existing unconfirmed user
44. POST /v1/auth/sign-up returns 400 for Cognito invalid input
45. POST /v1/auth/sign-up returns 400 for an invalid email

## Task 1 after moves and OpenAPI characterization

Commands from `apps/api`:

- `npm test` → `tests 46`, `pass 46`, `fail 0` (45 preserved baseline names each appear once, plus `GET /openapi.json characterizes health and auth operations`)
- `npm run check` → lint, jscpd, knip, typecheck exit 0
- `git diff --check` → exit 0

### Independent review

- Initial review: P1 lint/`check` failure in `openapi.test.ts`; session docs claimed green check prematurely.
- Fix: rewrite OpenAPI characterization helpers to satisfy eslint complexity and typing rules.
- Follow-up Important: characterization only spot-checked expected operations, so extra public paths/methods would pass, and verify request nullable coverage stopped at `session`.
- Fix: assert the exact generated path→method map; keep `/openapi.json` out of that map because `app.doc` serves it without listing it; assert `username`/`session`/`code` nullable as generated (`session: true` only on sign-up verify; others `undefined`).
- Re-run: targeted `test/openapi.test.ts`, `npm test` (46/46), `npm run check`, `git diff --check` all exit 0.
- Re-review status: no Critical/Important findings remaining.

### Test discovery

- `package.json` `test`: `node --import tsx --test "test/**/*.test.ts"`
- `package.json` `test:integration`: `node --import tsx --test "test/**/*.integration.ts"`

### Layout

- `test/modules/auth/routes/{sign-up,sign-up-verify,sign-in,sign-in-verify}.test.ts`
- `test/modules/auth/fixtures.ts`
- `test/infrastructure/cognito/client.test.ts`
- `test/infrastructure/database/owner-schema.test.ts`
- `test/infrastructure/observability/request-middleware.test.ts`
- `test/support/test-logger.ts`
- `test/openapi.test.ts`

### OpenAPI characterization matrix

Exact generated path→method map (extra paths or methods fail). `GET /openapi.json` returns 200 and is not itself listed in `paths`.

| Path | Method | Status codes |
| --- | --- | --- |
| `/health` | GET | 200, 500 |
| `/v1/auth/sign-up` | POST | 200, 400, 409, 429, 500 |
| `/v1/auth/sign-up/verify` | POST | 200, 400, 409, 429, 500 |
| `/v1/auth/sign-in` | POST | 200, 400, 409, 429, 500 |
| `/v1/auth/sign-in/verify` | POST | 200, 400, 409, 429, 500 |

Also asserted: OpenAPI `3.1.0`, component `Error`, email request required/nullable, and verify request required plus nullable (`username`/`code` `undefined`; `session` `true` only for sign-up verify, `undefined` for sign-in verify).

### Task 1 completion

- Independent re-review returned `APPROVED` with no Critical or Important findings.
- Task 1 is committed as `test: preserve API migration baseline`.
- Task 2 begins after this commit.

## Task 2: Shared HTTP, health, config, observability

### Documentation review (Zod health schema)

Reviewed before defining `healthResponseSchema`:

- Objects: <https://zod.dev/api?id=objects>
- Primitives: <https://zod.dev/api?id=primitives>
- Metadata: <https://zod.dev/metadata>

Decision: preserve the existing health response shape `{ status: z.literal('ok') }` with no added `.meta()` / `.describe()` metadata, matching the prior inline schema in `app.ts`.

Also consulted Hono routing/OpenAPI/middleware guidance referenced by the Task 2 skills (child `app.route()` mount, OpenAPIHono route registration, shared error envelope).

### TDD Step 1 (red)

Updated imports to target paths and added health aggregate assertion. Targeted command failed with unresolved modules:

- `src/modules/health/index.js`
- `src/infrastructure/config/index.js`
- `src/infrastructure/observability/logger.js`

### Delivered layout

- `src/shared/http/types.ts` — `AppVariables`, `App`
- `src/shared/http/error-contract.ts` — `errorSchema` (moved from `contracts/error.ts`)
- `src/modules/health/contracts.ts` — `healthResponseSchema`
- `src/modules/health/routes/health.ts` — `healthRoute`, `registerHealthRoute`
- `src/modules/health/index.ts` — `registerHealthRoutes()`, re-exports `healthRoute`
- `src/infrastructure/config/index.ts` — config loaders (moved from `config.ts`)
- `src/infrastructure/observability/{logger,request-middleware,sentry}.ts` (moved from `observability/`)

Removed old paths: `src/config.ts`, `src/contracts/`, `src/observability/`.

### App wiring

- `createApp(dependencies, registerRoutes?)` mounts `registerHealthRoutes()` at `/` via `app.route('/', …)`.
- Auth routes still register through optional `registerRoutes` on the root app (full public paths unchanged).
- Feature routes and fixtures import `App` from `shared/http/types` (not `app.ts`).
- `instrument.ts` / `index.ts` / `db/client.ts` / `auth/contracts.ts` import infrastructure or shared targets.

### Dependency direction

- `src/modules` and `src/shared` have no `infrastructure` imports.
- Production health module depends inward on `shared/http` only.

### Gates

Commands from `apps/api` (temporary symlink to main checkout `node_modules`, removed before finish):

- Targeted: `node --import tsx --test test/app.test.ts test/config.test.ts test/infrastructure/observability/request-middleware.test.ts` → pass 25
- `npm test` → `tests 47`, `pass 47`, `fail 0`
  - 45 baseline names preserved
  - Task 1 OpenAPI characterization retained
  - New: `registerHealthRoutes serves GET /health`
- `npm run check` → lint, jscpd, knip, typecheck exit 0
- `git diff --check` → exit 0

### Task 2 completion

- Codex independently repeated the targeted 25-test suite, full 47-test suite, lint, jscpd, knip, typecheck, and `git diff --check`; every gate passed.
- Moved config, error, logger, request-middleware, and Sentry files have the same Git blob hashes as their previous locations.
- Independent review returned `APPROVED` with no Critical or Important findings.
- Task 2 is committed as `refactor: extract API platform boundaries`.

## Task 3: Owner module and Drizzle repository

### Documentation review (Drizzle)

Official docs already reviewed for this task (recorded for session evidence):

- Schema organization / unchanged Owner table: <https://orm.drizzle.team/docs/sql-schema-declaration>, <https://orm.drizzle.team/docs/indexes-constraints>
- Insert / select / transaction repository flow: <https://orm.drizzle.team/docs/insert>, <https://orm.drizzle.team/docs/select>, <https://orm.drizzle.team/docs/transactions>
- Unchanged migration generation/config: <https://orm.drizzle.team/docs/drizzle-kit-generate>, <https://orm.drizzle.team/docs/drizzle-config-file>
- Unchanged one-Pool client: <https://orm.drizzle.team/docs/get-started-postgresql>

Decisions:

- Keep the Owner table shape unchanged (same columns, uniqueness on `cognito_subject`, no new migration SQL).
- Move schema source to `src/infrastructure/database/schema/*.ts` and point drizzle-kit `schema` glob there; `db:generate` must report no schema changes.
- Keep one `pg.Pool` per process via relocated `createDbClient`.
- `createDrizzleOwnerRepository` runs one `database.transaction()`: `insert…onConflictDoNothing({ target: owners.cognitoSubject }).returning()`, return mapped row when present, otherwise `select` by `owners.cognitoSubject` with `limit(1)`.
- Map DB rows to module `Owner` privately (`avatarUrl: null`; `displayName` from the row).
- Verification routes keep current signatures; temporary `ownerFromCognitoSubject` calls the repository; serialization accepts module `Owner`.

### TDD Step 1 (red)

`test/infrastructure/database/drizzle-owner-repository.test.ts` failed with unresolved `src/infrastructure/database/repositories/drizzle-owner-repository.js`.

### Delivered layout

- `src/modules/owners/{types,repository,index}.ts` — `Owner`, `OwnerRepository`
- `src/infrastructure/database/schema/owner.ts` — moved from `src/schema/owner.ts` (unchanged table)
- `src/infrastructure/database/client.ts` — moved from `src/db/client.ts` (schema import updated)
- `src/infrastructure/database/repositories/drizzle-owner-repository.ts` — `createDrizzleOwnerRepository`
- `src/auth/owner.ts` — temporary compatibility helper through the repository
- `apps/api/drizzle.config.ts` — `schema: './src/infrastructure/database/schema/*.ts'`
- Unit: `test/infrastructure/database/drizzle-owner-repository.test.ts` (4)
- Integration: `test/infrastructure/database/drizzle-owner-repository.integration.ts` (1)
- Updated imports: verify routes, fixtures, owner-schema test, `index.ts`, `server.ts`

### Migration evidence

From `apps/api`:

- `npm run db:generate` → `No schema changes, nothing to migrate`
- `git diff --exit-code -- drizzle` → exit 0 (empty)

### Integration evidence

Used main checkout env file in place (`/Users/matsuokashuhei/Development/walk-dog/apps/.env.local`) without copying or printing secrets. Started only the scoped postgres service (did not stop/remove user containers).

- `docker compose --env-file …/apps/.env.local -f …/apps/compose.yml up -d postgres` → started
- `POSTGRES_HOST=127.0.0.1 npm run migrate` → migrations applied successfully
- `POSTGRES_HOST=127.0.0.1 npm run test:integration` → `tests 1`, `pass 1`, `fail 0` (`resolveByCognitoSubject is concurrent-safe for the same subject`)

### Gates

Commands from `apps/api` (temporary symlink to main checkout `node_modules`, removed before finish):

- Targeted: `node --import tsx --test test/infrastructure/database/owner-schema.test.ts test/infrastructure/database/drizzle-owner-repository.test.ts test/modules/auth/routes/sign-up-verify.test.ts test/modules/auth/routes/sign-in-verify.test.ts` → pass 14
- `npm test` → `tests 51`, `pass 51`, `fail 0`
  - 45 baseline names preserved
  - Task 1 OpenAPI + Task 2 health aggregate retained
  - New unit: 4 Owner repository tests
- `npm run check` → lint, jscpd, knip, typecheck exit 0
- `git diff --check` → exit 0

### Codex inspection

- Finding: `createDrizzleOwnerRepository` called `onConflictDoNothing()` with no target, so any unique/primary-key conflict could enter the existing-subject select branch.
- Fix: target the unique `owners.cognitoSubject` column via `onConflictDoNothing({ target: owners.cognitoSubject })`.
- Unit tests: insert and conflict paths now assert the exact `onConflictDoNothing` config `{ target: owners.cognitoSubject }` in addition to call order and insert values.

### Gates after Codex fix

Commands from `apps/api` (temporary symlink to main checkout `node_modules`, removed before finish):

- Repository unit: `node --import tsx --test test/infrastructure/database/drizzle-owner-repository.test.ts` → pass 4
- Targeted: `node --import tsx --test test/infrastructure/database/owner-schema.test.ts test/infrastructure/database/drizzle-owner-repository.test.ts test/modules/auth/routes/sign-up-verify.test.ts test/modules/auth/routes/sign-in-verify.test.ts` → pass 14
- `npm test` → `tests 51`, `pass 51`, `fail 0`
- `npm run check` → lint, jscpd, knip, typecheck exit 0
- `git diff --check` → exit 0

### Independent Important finding (integration cleanup)

- Finding: `drizzle-owner-repository.integration.ts` awaited subject-row delete and only afterward closed the pg Pool. If delete rejected, pool close was skipped and the test runner/CI could retain live handles.
- Fix: outer `finally` uses nested `try/finally` so the subject-only delete remains attempted and `closeDbClient(pool)` always runs. Deletion scope unchanged (`eq(owners.cognitoSubject, cognitoSubject)` only).

### Gates after integration cleanup fix

Commands from `apps/api` (temporary symlink to main checkout `node_modules`, removed before finish). Env loaded in place from main `apps/.env.local` without copying or printing secrets; `POSTGRES_HOST=127.0.0.1` for local postgres.

- Integration: `npm run test:integration` → `tests 1`, `pass 1`, `fail 0` (`resolveByCognitoSubject is concurrent-safe for the same subject`)
- Targeted: `node --import tsx --test test/infrastructure/database/owner-schema.test.ts test/infrastructure/database/drizzle-owner-repository.test.ts test/modules/auth/routes/sign-up-verify.test.ts test/modules/auth/routes/sign-in-verify.test.ts` → pass 14
- `npm test` → `tests 51`, `pass 51`, `fail 0`
- `npm run check` → lint, jscpd, knip, typecheck exit 0
- `git diff --check` → exit 0
- `npm run db:generate` → `No schema changes, nothing to migrate`; `git diff --exit-code -- drizzle` → exit 0

### Task 3 status

- Codex finding on untargeted `onConflictDoNothing` resolved; local gates re-run after the fix.
- Independent Important finding on integration pool cleanup resolved; local gates re-run after the fix.
- Independent re-review returned `APPROVED` with no Critical or Important findings.
- Task 3 is committed as `refactor: add Owner repository boundary`.
