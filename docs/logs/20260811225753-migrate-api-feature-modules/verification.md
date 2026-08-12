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

## Task 4: Sign Up and Sign In start slices

### Documentation review (AWS Cognito)

Official AWS Cognito User Pools API docs reviewed for adapter command inputs and documented exceptions:

- SignUp: <https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_SignUp.html>
- ResendConfirmationCode: <https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_ResendConfirmationCode.html>
- InitiateAuth: <https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_InitiateAuth.html>

Decisions: adapter builds `SignUpCommand`, `ResendConfirmationCodeCommand`, and `InitiateAuthCommand` inputs; maps documented Cognito exceptions to module outcomes (`username-exists`, `already-confirmed`, `invalid-input`, `rate-limited`, `authentication-failed`, `incomplete-challenge`); propagates unexpected errors unchanged.

### Documentation review (Zod)

Reviewed before placing start-route schemas in `modules/auth/contracts.ts`:

- Objects: <https://zod.dev/api?id=objects>
- String formats: <https://zod.dev/api?id=string-formats>
- Metadata: <https://zod.dev/metadata>

Decision: preserve existing request/response shapes with `z.email()` for email, nested `codeDelivery` objects, and nullable session/codeDelivery on Sign Up; no added `.meta()` / `.describe()` beyond the prior OpenAPI wiring. Re-export shared `errorSchema` as `authErrorSchema`.

### Documentation review (Hono routing)

Reviewed for endpoint module placement and registration:

- Routing: <https://hono.dev/docs/api/routing>
- Context / request validation used via existing OpenAPIHono `c.req.valid('json')` and `app.openapi(route, handler)`
- Testing: listener-less `app.request()` per Hono Testing Guide

Decisions: one endpoint module per method/path; export `signUpRoute` / `signInRoute` and `registerSignUpRoute` / `registerSignInRoute`; keep full public paths `/v1/auth/sign-up` and `/v1/auth/sign-in` during Task 4; temporary root aggregator in `routes/index.ts` re-exports start registrars with verify routes; handlers call the injected use case once and map outcomes to existing HTTP envelopes; unexpected use-case throws flow through global `onError` (`INTERNAL_ERROR` 500).

### Delivered layout

- `src/modules/auth/{types,errors,provider,contracts}.ts`
- `src/modules/auth/use-cases/{start-sign-up,start-sign-in}.ts`
- `src/modules/auth/routes/{sign-up,sign-in}.ts` — exported `signUpRoute` / `signInRoute` plus registrars
- `src/infrastructure/cognito/client.ts` — moved from `src/auth/cognito.ts`; production factory is `createCognitoClient(config)` with optional sender defaulting to `new CognitoIdentityProviderClient({ region: config.region })`; infrastructure tests may pass a recording sender
- `src/infrastructure/cognito/cognito-auth-provider.ts` — start operations only
- Temporary aggregator: `src/routes/index.ts` registers start routes from modules and verify routes from `src/routes/`
- Composition: `src/index.ts` calls `createCognitoClient(cognitoConfig)` (no direct AWS SDK construction/import) → auth provider → start use cases → route registrars
- Tests: `test/modules/auth/use-cases/start-sign-{up,in}.test.ts`, `test/infrastructure/cognito/cognito-auth-provider.test.ts`, updated start-route tests and fixtures

Removed old paths: `src/auth/cognito.ts`, `src/routes/sign-up.ts`, `src/routes/sign-in.ts`. Verify routes remain under `src/routes/`.

### Dependency direction

- Auth use cases / types / errors / provider have no `infrastructure`, `@aws-sdk`, or Hono imports.
- Auth contracts import `z` from classic `zod`; route modules keep `@hono/zod-openapi` for OpenAPI wiring.
- Cognito adapter and client own AWS SDK commands and exception classes.
- Start routes depend on module contracts/types and shared `App` only.
- Production modules do not import deleted `src/auth/cognito` or old start-route paths.

### Codex completion-gap fixes

After Codex inspection of the uncommitted Task 4 work (targeted 38 / full 80 already green):

1. Export `signUpRoute` and `signInRoute` from endpoint modules (names, paths, contracts, behavior unchanged).
2. Add missing route contract coverage with full error envelope (`code` / `message` / `requestId` / `retryable`) and exactly one use-case call for valid input:
   - Sign Up `rate-limited` → 429
   - Sign Up unexpected use-case throw → global 500 `INTERNAL_ERROR`
   - Sign In `authentication-failed` → 409
   - Sign In `incomplete-challenge` → explicit 500 `INTERNAL_SERVER_ERROR`
   - Sign In unexpected use-case throw → global 500 `INTERNAL_ERROR`
3. Preserve existing baseline start-route test names.

### Independent Important findings and fixes

1. Production factory: restore `createCognitoClient(config)` with optional sender defaulting to `new CognitoIdentityProviderClient({ region: config.region })`; preserve returned `client` and all methods; `index.ts` calls `createCognitoClient(cognitoConfig)` and drops direct AWS SDK construction/import. Infrastructure tests may still inject a recording sender.
2. Start-route tests: add malformed JSON body cases (syntactically invalid JSON) to both Sign Up and Sign In suites; assert shared 400 `INVALID_INPUT` full envelope and empty use-case call log; keep existing invalid-email cases and baseline names. Hono surfaces malformed JSON as `HTTPException` status 400; `app.onError` maps that status to the same shared `INVALID_INPUT` envelope as the Zod `defaultHook`.
3. Contracts: `modules/auth/contracts.ts` imports `z` from classic `zod` (not `@hono/zod-openapi`); schemas and OpenAPI/runtime behavior unchanged; route wiring remains with `@hono/zod-openapi`.

### Gates

Commands from `apps/api` (temporary symlink to main checkout `node_modules`, removed before finish):

- Targeted: `node --import tsx --test test/modules/auth/routes/sign-up.test.ts test/modules/auth/routes/sign-in.test.ts test/modules/auth/use-cases/start-sign-up.test.ts test/modules/auth/use-cases/start-sign-in.test.ts test/infrastructure/cognito/client.test.ts test/infrastructure/cognito/cognito-auth-provider.test.ts` → `tests 45`, `pass 45`, `fail 0`
- `npm test` → `tests 87`, `pass 87`, `fail 0`
  - 45 baseline names preserved
  - Task 1 OpenAPI + Task 2 health aggregate + Task 3 Owner repository unit tests retained
  - New start use-case, Cognito adapter, start-route contract cases, and two malformed-JSON cases included
- OpenAPI characterization: `node --import tsx --test test/openapi.test.ts` → pass
- `npm run check` → lint, jscpd, knip, typecheck exit 0
- `git diff --check` → exit 0

Dependency checks (positive): auth use-case boundary has no `@aws-sdk` / `infrastructure` / Hono imports; production code has no remaining `auth/cognito` imports; `index.ts` has no `@aws-sdk/client-cognito-identity-provider` import.

### Task 4 status

- Implementation, Codex completion-gap fixes, and independent Important finding fixes are recorded; fresh gates passed (targeted 45, full 87, OpenAPI, check, diff --check).
- Independent re-review returned `APPROVED` with no Critical or Important findings.
- Task 4 is committed as `refactor: extract authentication start slices`.

## Task 5: OTP verification slices

### Documentation review (AWS Cognito)

Official AWS Cognito User Pools API docs reviewed for verify adapter command inputs, authentication result tokens, and ID-token subject:

- ConfirmSignUp: <https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_ConfirmSignUp.html>
- RespondToAuthChallenge: <https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_RespondToAuthChallenge.html>
- AuthenticationResultType: <https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AuthenticationResultType.html>
- Cognito ID token guide: <https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-id-token.html>
- InitiateAuth (post-confirm follow-up): <https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_InitiateAuth.html>

Decisions:

- Sign-up verify: `ConfirmSignUpCommand` then `InitiateAuthCommand` (USER_AUTH / EMAIL_OTP), using confirm Session when present and falling back to the request session.
- Sign-in verify: `RespondToAuthChallengeCommand` with ChallengeName `EMAIL_OTP` and `EMAIL_OTP_CODE`.
- Require AccessToken, IdToken, and RefreshToken from `AuthenticationResult`; decode the ID-token payload and require a string `sub`; return camelCase `Authentication`. Missing tokens or a non-string `sub` map to `incomplete-authentication`.
- Documented exception mapping:
  - `ExpiredCodeException` → `code-expired`
  - `CodeMismatchException` → `invalid-code`
  - `AliasExistsException` → `code-already-used`
  - `NotAuthorizedException` → `already-confirmed` (sign-up verify) / `authentication-failed` (sign-in verify)
  - `TooManyRequestsException` / `LimitExceededException` → `rate-limited`
  - All other errors propagate unchanged by identity.
- Production Cognito client factory remains `createCognitoClient(config)` with optional recording sender for infrastructure tests.

### Delivered layout

- `src/modules/auth/provider.ts` — extended with `verifySignUp` / `verifySignIn` and provider result unions
- `src/modules/auth/types.ts` — `Authentication`, `VerifySignUp` / `VerifySignIn`, verify result unions
- `src/modules/auth/contracts.ts` — verify request schemas and `authenticationResponseSchema` (classic `zod`)
- `src/modules/auth/authentication-response.ts` — `toAuthenticationResponse` (tokens + Owner ISO timestamps)
- `src/modules/auth/use-cases/verify-sign-up.ts` — `createVerifySignUp(provider, owners)`
- `src/modules/auth/use-cases/verify-sign-in.ts` — `createVerifySignIn(provider, owners)`
- `src/modules/auth/routes/sign-up-verify.ts` — exported `signUpVerifyRoute` + `registerSignUpVerifyRoute`
- `src/modules/auth/routes/sign-in-verify.ts` — exported `signInVerifyRoute` + `registerSignInVerifyRoute`
- `src/infrastructure/cognito/cognito-auth-provider.ts` — verify adapter operations
- Temporary aggregator: `src/routes/index.ts` re-exports start and verify registrars from modules
- Composition: `src/index.ts` wires verify use cases with auth provider + Owner repository
- Tests: verify use-case suites, `cognito-auth-provider-verify.test.ts`, shared `recording-provider.ts`, expanded verify-route contract tests, fixtures cleaned of transitional helpers

Removed: `src/auth/contracts.ts`, `src/auth/owner.ts`, `src/routes/sign-up-verify.ts`, `src/routes/sign-in-verify.ts`, and the unused intermediate `src/modules/auth/use-cases/verify-auth.ts`.

### Use-case boundaries

- Each verify use case calls the matching provider method once.
- Owner resolution runs only for `outcome: 'authenticated'`, keyed by `authentication.subject`.
- Known provider failures return unchanged without Owner calls.
- Unexpected provider or Owner errors propagate by identity.

### Route contract matrix

Preserved Japanese messages, status codes, error codes, and retryable flags:

| Endpoint | Outcome | Status | Code | Retryable |
| --- | --- | --- | --- | --- |
| Sign-up verify | authenticated | 200 | (tokens+owner) | — |
| Sign-up verify | code-expired | 400 | CODE_EXPIRED | false |
| Sign-up verify | invalid-code | 400 | INVALID_CODE | false |
| Sign-up verify | code-already-used | 400 | CODE_ALREADY_USED | false |
| Sign-up verify | already-confirmed | 409 | AUTHENTICATION_FAILED | false |
| Sign-up verify | rate-limited | 429 | RATE_LIMITED | true |
| Sign-up verify | incomplete-authentication | 500 | INTERNAL_SERVER_ERROR | true |
| Sign-in verify | authenticated | 200 | (tokens+owner) | — |
| Sign-in verify | code-expired | 400 | CODE_EXPIRED | true |
| Sign-in verify | invalid-code | 400 | INVALID_CODE | false |
| Sign-in verify | code-already-used | 400 | CODE_ALREADY_USED | false |
| Sign-in verify | authentication-failed | 409 | AUTHENTICATION_FAILED | true |
| Sign-in verify | rate-limited | 429 | RATE_LIMITED | true |
| Sign-in verify | incomplete-authentication | 500 | INTERNAL_SERVER_ERROR | true |

Also covered: empty/invalid schema and malformed JSON → 400 `INVALID_INPUT` full envelope with empty use-case call log; unexpected use-case throw → global 500 `INTERNAL_ERROR`. Full public paths remain `/v1/auth/sign-up/verify` and `/v1/auth/sign-in/verify`. Sign-in-verify route contract tests cover every documented use-case outcome in the matrix above, including reachable `code-already-used` → 400 `CODE_ALREADY_USED` with the complete Japanese envelope (`code` / `message` / `requestId` / `retryable`) and exactly one use-case call with the validated input.

### Dependency direction

Positive checks:

- Auth use cases (`verify-sign-up.ts`, `verify-sign-in.ts`) import only module provider/types and `OwnerRepository`; no Hono, `@aws-sdk`, Drizzle, or `infrastructure` imports.
- Auth contracts import `z` from classic `zod`; route modules keep `@hono/zod-openapi` for OpenAPI wiring.
- Cognito adapter owns AWS SDK commands/exception classes and token/`sub` conversion.
- Production code has no remaining imports of deleted `src/auth/contracts`, `src/auth/owner`, or old `src/routes/sign-{up,in}-verify` paths.
- `src/auth/` directory is gone; only the temporary `src/routes/index.ts` aggregator remains under `src/routes/`.

### Codex unused intermediate file

- Detection: `npm run check` / knip reported unused `src/modules/auth/use-cases/verify-auth.ts`.
- Cause: duplicate intermediate that re-exported both verify factories; planned and imported files are `verify-sign-up.ts` and `verify-sign-in.ts`.
- Fix: removed only `verify-auth.ts`; kept the individual use cases and their imports in `index.ts` / tests.
- Diff inspection: no other unfinished intermediate production files or imports remain (`authentication-response.ts` and test `recording-provider.ts` are intentional shared helpers).

### Independent Important finding (sign-in CODE_ALREADY_USED route contract)

- Finding: `sign-in-verify` route contract suite omitted the reachable `code-already-used` use-case outcome while checklist/verification claimed every documented outcome; production already maps that outcome to 400 `CODE_ALREADY_USED`.
- Fix: added `POST /v1/auth/sign-in/verify returns CODE_ALREADY_USED when the alias exists` asserting status 400, complete Japanese envelope (`CODE_ALREADY_USED`, message, `requestId`, `retryable: false`), and exactly one use-case call with the validated input. Production behavior unchanged.

### Gates

Commands from `apps/api` (temporary symlink to main checkout `node_modules`, removed before finish):

- Targeted: `node --import tsx --test test/modules/auth/routes/sign-up-verify.test.ts test/modules/auth/routes/sign-in-verify.test.ts test/modules/auth/use-cases/verify-sign-up.test.ts test/modules/auth/use-cases/verify-sign-in.test.ts test/infrastructure/cognito/cognito-auth-provider.test.ts test/infrastructure/cognito/cognito-auth-provider-verify.test.ts test/infrastructure/database/drizzle-owner-repository.test.ts` → `tests 70`, `pass 70`, `fail 0` (pre-finding)
- OpenAPI characterization: `node --import tsx --test test/openapi.test.ts` → `tests 1`, `pass 1`, `fail 0`
- `npm test` → `tests 129`, `pass 129`, `fail 0` (pre-finding)
  - 45 baseline names preserved
  - Task 1 OpenAPI + Task 2 health aggregate + Task 3 Owner repository unit tests + Task 4 start slices retained
  - New verify use-case, Cognito verify adapter, and verify-route contract coverage included
- `npm run check` → lint, jscpd, knip, typecheck exit 0
- `git diff --check` → exit 0

### Gates after Independent Important finding fix

Commands from `apps/api` (temporary symlink to main checkout `node_modules`, removed before finish):

- Targeted: `node --import tsx --test test/modules/auth/routes/sign-up-verify.test.ts test/modules/auth/routes/sign-in-verify.test.ts test/modules/auth/use-cases/verify-sign-up.test.ts test/modules/auth/use-cases/verify-sign-in.test.ts test/infrastructure/cognito/cognito-auth-provider.test.ts test/infrastructure/cognito/cognito-auth-provider-verify.test.ts test/infrastructure/database/drizzle-owner-repository.test.ts` → `tests 71`, `pass 71`, `fail 0`
- OpenAPI characterization: `node --import tsx --test test/openapi.test.ts` → `tests 1`, `pass 1`, `fail 0`
- `npm test` → `tests 130`, `pass 130`, `fail 0`
  - 45 baseline names preserved
  - Prior Task slices retained
  - Added sign-in-verify `CODE_ALREADY_USED` route contract case
- `npm run check` → lint, jscpd, knip, typecheck exit 0
- `git diff --check` → exit 0

### Task 5 completion

- Implementation complete; Codex unused-intermediate finding resolved; Independent Important sign-in `CODE_ALREADY_USED` route-contract gap closed.
- Codex freshly re-ran targeted 71/71, OpenAPI 1/1, full 130/130, `npm run check`, and `git diff --check`; every gate passed.
- Independent re-review returned `APPROVED` with no Critical or Important findings.
- Task 5 is committed as `refactor: extract authentication verification slices`.
- Task 6 follows in the sections below and completes at 145 unit tests with independent `APPROVED` re-reviews and commit `refactor: compose feature-first API`.

## Task 6A: Route aggregation and pure application composition

Scope: Task 6 Steps 1–4 (auth aggregate, `ModuleRoute[]` app mount, import-safe `createApplication`). Task 6B delivers server lifecycle, package entry, and Cognito resource boundary on top of this slice.

### Deliverables

- Created `apps/api/src/modules/auth/routes/index.ts` with `registerAuthRoutes` registering all four endpoints before returning the child.
- Created `apps/api/src/modules/auth/index.ts` exporting `registerAuthRoutes` and `AuthRouteDependencies`.
- Changed auth endpoint OpenAPI paths to child-relative `/sign-up`, `/sign-up/verify`, `/sign-in`, `/sign-in/verify`.
- Kept health child at `/health`; production mounts `{ path: '/', app: healthRoutes }` and `{ path: '/v1/auth', app: authRoutes }`.
- Changed `createApp(dependencies, routes: ModuleRoute[])` to apply middleware/global hooks once, mount each completed child exactly once, then register OpenAPI doc so `/openapi.json` sees all operations.
- Rewrote `apps/api/src/index.ts` as import-safe `createApplication(env, factories?)`: loads configs once, creates one logger/DB/Cognito, shares identity through auth provider/Owner repository/four use cases, creates auth and health children, creates app, returns `{ app, resources }`. Importing `index.ts` performs no config/listener/DB/AWS construction.
- Removed transitional `apps/api/src/routes/`.
- Added `test/modules/auth/auth-routes.test.ts` and `test/composition.test.ts`; updated app/openapi/request-middleware tests and auth fixtures/route path assertions.
- Health handler uses `{ status: 'ok' as const }` so OpenAPI typed response matches the literal schema (typecheck gate).

### Inspection

- Searched Task 6A production and test sources for unfinished markers (`TODO`/`FIXME`/`XXX`/`HACK`/placeholder unfinished comments): none.
- Codex diagnosed earlier intermittent HTTP 500s as a temporary dependency-layout issue: a real worktree `apps/api/node_modules` directory that contained a nested `node_modules` symlink loaded two Hono copies and broke `routePath`. That nested layout was removed; production code was not changed to compensate.

### Gates

Commands from `apps/api` using exactly one temporary symlink `apps/api/node_modules` → main checkout `apps/api/node_modules` (no nested symlink). After gates, the symlink was unlinked; `apps/api/node_modules` is absent.

- Targeted Task 6A: `node --import tsx --test test/modules/auth/auth-routes.test.ts test/composition.test.ts test/app.test.ts test/openapi.test.ts test/modules/auth/routes/sign-up.test.ts test/modules/auth/routes/sign-up-verify.test.ts test/modules/auth/routes/sign-in.test.ts test/modules/auth/routes/sign-in-verify.test.ts` → `tests 47`, `pass 47`, `fail 0`
- Full suite: `npm run test` / `node --import tsx --test "test/**/*.test.ts"` → `tests 134`, `pass 134`, `fail 0`
  - All 45 baseline names appear exactly once
  - +2 auth aggregate +2 composition over Task 5’s 130
- `npm run check` → lint, jscpd, knip, typecheck exit 0
- `npm run build` → exit 0
- Import-boundary classification: top-level transitional directories `src/{auth,routes,db,contracts,observability,schema}` remain removed; remaining `routes`/`contracts`/`schema` imports resolve under `modules/` or `infrastructure/database/schema`.
- `git diff --check` → exit 0

## Task 6B: Server lifecycle, package entry, Cognito resource boundary

### Documentation review (official skills)

Task 6B and the finding fixes recorded these official URLs from the already-read local skills:

- Hono Node: <https://hono.dev/docs/getting-started/nodejs>
- Hono App: <https://hono.dev/d%6Fcs/api/hono>
- Hono Routing: <https://hono.dev/d%6Fcs/api/routing>
- Hono Testing: <https://hono.dev/d%6Fcs/guides/testing>
- Node.js Test Runner: <https://nodejs.org/api/test.html>

Decisions: `src/index.ts` remains import-safe `createApplication`; `src/server.ts` owns `@hono/node-server` serve, signal registration, and idempotent shutdown; package `dev`/`start` point at `src/server.ts` / `dist/server.js`; lifecycle and entry-boundary tests use the Node.js test runner with listener-less doubles and short-lived subprocesses.

### Deliverables

- `src/server.ts` is the serve/signal/idempotent-shutdown owner with injectable `createApplication` / `start` / `process`.
- Shutdown close order is listener → Pool → Cognito → Sentry; concurrent and repeated shutdown share one promise; each resource closes once.
- Cognito infrastructure exposes required `destroy()` (`CognitoSender.destroy`; production sender uses `CognitoIdentityProviderClient.destroy()`).
- Package scripts: `dev` → `tsx watch --import ./src/instrument.ts src/server.ts`; `start` → `node --import ./dist/instrument.js dist/server.js`; `knip.json` entry points to `server.ts` / `dist/server.js`.
- `instrument.ts` remains the Sentry preload that loads relocated infrastructure config only.
- Transitional first-level `src/{auth,routes,db,contracts,observability,schema}` remain removed.

### Initial implementation gates

Commands from `apps/api` under one temporary `node_modules` symlink (removed after):

- Targeted composition/server/auth aggregate/app/OpenAPI suite → `tests 54`, `pass 54`, `fail 0`
- `npm test` → `tests 140`, `pass 140`, `fail 0` (45 baseline names once)
- `npm run check` → lint, jscpd, knip, typecheck exit 0
- `npm run build` → exit 0
- `npm run test:integration` → `tests 1`, `pass 1`, `fail 0`
- `npm run db:generate` → `No schema changes, nothing to migrate`; `git diff --exit-code -- drizzle` → exit 0
- Import-boundary classification completed for transitional top-level paths versus canonical module/infrastructure imports
- `git diff --check` → exit 0

### Independent Important findings

1. Downstream cleanup skipped: when an earlier close rejected or threw, later resources in the listener→Pool→Cognito→Sentry sequence were left unattempted.
2. Vacuous entry tests: import-safety and direct-run coverage asserted types/strings without proving isolated import behavior or direct source startup.
3. Artifact mismatch: session records still described Task 6B as pending while server lifecycle, package entry, and Cognito `destroy()` were already delivered.

### Focused fixes

1. `createShutdownHandler` attempts every close exactly once in listener→Pool→Cognito→Sentry order when an earlier close rejects or throws; preserves the first failure in that order; concurrent and repeated calls keep the same idempotent promise.
2. Added Pool-failure and Cognito-failure tests that assert once/order/error identity while the remaining closes still run; the two baseline shutdown names remain exactly once.
3. Replaced vacuous entry assertions with subprocess coverage: importing `src/index.ts` under a sanitized incomplete env completes without constructing config/DB/AWS/listener; direct source server execution demonstrably invokes startup.
4. Package `dev`/`start` scripts target source and dist server entries; `isDirectRun` checks cover both source and dist entry paths.

### Codex fresh final results (after finding fixes)

Commands from `apps/api` under one temporary `node_modules` symlink (removed after):

- Targeted Task 6 entry/lifecycle/composition suite → `tests 26`, `pass 26`, `fail 0`
- `npm test` → `tests 145`, `pass 145`, `fail 0` (45 baseline names once)
- `npm run check` → lint, jscpd, knip, typecheck exit 0
- `npm run build` → exit 0
- `npm run test:integration` → `tests 1`, `pass 1`, `fail 0`
- `npm run db:generate` → `No schema changes, nothing to migrate`; `git diff --exit-code -- drizzle` → exit 0
- `scripts/agent-skills.sh check` → exit 0
- Import-boundary classification completed for transitional top-level paths versus canonical module/infrastructure imports
- `git diff --check` → exit 0

### Dependency-link cleanup

Codex cleaned and verified both temporary dependency links absent:

- Worktree `apps/api/node_modules` is absent.
- Main-checkout nested `apps/api/node_modules/node_modules` self-link is absent.
- Main-checkout user-owned changes remain untouched.

### Task 6 completion

- Task 6A and Task 6B implementation are complete.
- Independent Important finding fixes are complete; Codex fresh final gates passed (targeted 26/26, full 145/145, check, build, integration 1/1, db:generate/drizzle diff, agent-skills check, import-boundary classification, `git diff --check`).
- Both independent re-reviews returned exactly `APPROVED` with no Critical or Important findings.
- Task 6 is committed as `refactor: compose feature-first API`.

### Publication and merge

- Published PR #47 with the completed migration and session artifacts; GitHub CI passed lint, jscpd, knip, and typecheck.
- User approved PR #47; GitHub merged it into `main` as `dd38d690ab594160457da20359bd04a58581723d`.
- Follow-up branch `agent/api-feature-module-migration-retrospective-20260812121500` holds the mandatory post-merge retrospective and the five approved, implemented, forward-tested skill updates.
- All five quick validations, `scripts/agent-skills.sh check`, and `git diff --check` passed for the follow-up change set.
- PR #48 feedback localized every changed canonical skill body to Japanese. Four canonical/`SKILL_ja.md` pairs are byte-identical; `testing-hono-apis` was already Japanese. Cursor Agent semantic re-review returned `APPROVED` after six translation fixes.
- PR #48 follow-up removed the four redundant `SKILL_ja.md` files after canonical Japanese localization. `testing-hono-apis` had no sibling and remained unchanged. Skill synchronization, consistency check, and diff check passed.
