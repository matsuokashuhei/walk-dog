# API Feature Module Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/api`を公開HTTP契約と45件の挙動baselineを維持したまま、`modules`、`infrastructure`、`shared`、composition rootへ移行する。

**Architecture:** Hono routeはmodule contractを使ってuse caseを一度呼び、use caseはmodule-owned provider/repository interfaceへ依存する。CognitoとDrizzleの具象実装はinfrastructureに置き、`src/index.ts`がobject graphを構成し、`src/server.ts`がlistenerとresource lifecycleを所有する。

**Tech Stack:** TypeScript、Node.js test runner、Hono、`@hono/zod-openapi`、Zod 4、AWS SDK v3 Cognito、Drizzle ORM、PostgreSQL、Pino、Sentry

## Global Constraints

- 公開method、path、request、success/error status、response body、OpenAPI 3.1 documentを維持する。
- 現在の45 test名とassertionをnested test layoutへ移し、追加test後も全45件の存在と成功を確認する。
- `src/modules`はfeature contract、route、use case、provider/repository interface、feature typeを所有する。
- `src/infrastructure`はAWS SDK、Drizzle、PostgreSQL、config、Pino、Sentryの具象実装を所有する。
- `src/shared`は複数moduleが同じ意味で利用するHTTP contractとHono context typeを所有する。
- Use caseのimportはmodule type、error、provider/repository interfaceで構成する。
- Endpoint fileはURL語順、route定数は`…Route`、個別登録関数は`register…Route`、feature集約関数は`register…Routes`を使用する。
- Default test commandは`node --import tsx --test "test/**/*.test.ts"`、integration commandは`node --import tsx --test "test/**/*.integration.ts"`を使用する。
- 各Taskはtargeted test、全default test、`npm run check`対象の関連gate、独立reviewを完了してからcommitする。
- このPRは現在の`.agents/skills/`を実装へ適用し、`scripts/agent-skills.sh check`で正本と分類viewの整合性を確認する。
- Commandは指定がある場合を除いて`apps/api`から実行し、repository commandは`../../`を起点にする。

## Task-to-design traceability

| Task | Design section | Deliverable | Acceptance condition |
| --- | --- | --- | --- |
| 1. Baseline and test layout | WHAT / Quality gates、HOW / Tests | Recursive discovery、nested 45-test baseline、OpenAPI characterization | 既存45 test名が成功し、healthと4 auth operationのcontract testが成功する。 |
| 2. Shared, health, config, observability | HOW / Source layout、Error ownership | `shared/http`、`modules/health`、`infrastructure/config`、`infrastructure/observability` | App/health/config/observability testsと全baselineが成功する。 |
| 3. Owner repository boundary | HOW / Dependency flow、Tests | Owner module interface、Drizzle schema/client/repository | Insert/existing mapping、transaction、schema source、route baselineが成功する。 |
| 4. Sign Up and Sign In slices | HOW / Vertical migration 4、Error ownership | Start-auth use cases、Cognito adapter operations、2 endpoint routes | Route/use-case/adapter testsと既存Sign Up/Sign In contractが成功する。 |
| 5. OTP verification slices | HOW / Vertical migration 5、Error ownership | Verify use cases、token subject conversion、Owner resolution、2 verify routes | Tokens/Owner、全既知error、short-circuit、unexpected propagation testsが成功する。 |
| 6. Aggregation, composition, lifecycle | HOW / Dependency flow、Vertical migration 6–7、Tests | Child route mount、pure composition factory、server lifecycle、target-only imports | OpenAPI一致、route一意性、composition/shutdown、全test、integration、quality gatesが成功する。 |

---

### Task 1: Preserve the baseline and move tests to feature-first discovery

**Files:**
- Modify: `apps/api/package.json`
- Move: `apps/api/test/sign-up.test.ts` → `apps/api/test/modules/auth/routes/sign-up.test.ts`
- Move: `apps/api/test/sign-up-verify.test.ts` → `apps/api/test/modules/auth/routes/sign-up-verify.test.ts`
- Move: `apps/api/test/sign-in.test.ts` → `apps/api/test/modules/auth/routes/sign-in.test.ts`
- Move: `apps/api/test/sign-in-verify.test.ts` → `apps/api/test/modules/auth/routes/sign-in-verify.test.ts`
- Move: `apps/api/test/auth-fixtures.ts` → `apps/api/test/modules/auth/fixtures.ts`
- Move: `apps/api/test/auth.test.ts` → `apps/api/test/infrastructure/cognito/client.test.ts`
- Move: `apps/api/test/schema.test.ts` → `apps/api/test/infrastructure/database/owner-schema.test.ts`
- Move: `apps/api/test/observability.test.ts` → `apps/api/test/infrastructure/observability/request-middleware.test.ts`
- Move: `apps/api/test/test-logger.ts` → `apps/api/test/support/test-logger.ts`
- Create: `apps/api/test/openapi.test.ts`
- Create: `docs/logs/20260811225753-migrate-api-feature-modules/completion-checklist.md`
- Create: `docs/logs/20260811225753-migrate-api-feature-modules/verification.md`

**Interfaces:**
- Consumes: Current `createApp`, four `register…Route` functions, `mockCognito`, `mockDb`.
- Produces: Recursive test commands and the preserved 45-test baseline used by every later Task.

- [ ] **Step 1: Run and record the current baseline**

Run from `apps/api`:

```bash
npm test
npm run check
```

Expected: TAP reports `tests 45`, `pass 45`, `fail 0`; lint, jscpd, knip, and typecheck exit 0. Record all 45 test names and the summary in the session `verification.md`.

- [ ] **Step 2: Configure recursive default and separate integration discovery**

Set the scripts exactly:

```json
{
  "test": "node --import tsx --test \"test/**/*.test.ts\"",
  "test:integration": "node --import tsx --test \"test/**/*.integration.ts\""
}
```

- [ ] **Step 3: Move existing tests and update imports only**

Preserve every `test('…')` name and assertion. Update relative imports to current production paths; for example:

```ts
import { registerSignUpRoute } from '../../../../src/routes/sign-up.js'
import { cognitoError, createAuthApp, mockCognito } from '../fixtures.js'
```

- [ ] **Step 4: Verify the moved baseline**

Run:

```bash
npm test
```

Expected: TAP still reports exactly `tests 45`, `pass 45`, `fail 0`, and every name recorded in Step 1 appears once.

- [ ] **Step 5: Add an OpenAPI characterization test**

Register all four current auth routes on the test app, request `/openapi.json`, and assert this matrix:

```ts
const expectedOperations = {
  '/health': { get: ['200', '500'] },
  '/v1/auth/sign-up': { post: ['200', '400', '409', '429', '500'] },
  '/v1/auth/sign-up/verify': { post: ['200', '400', '409', '429', '500'] },
  '/v1/auth/sign-in': { post: ['200', '400', '409', '429', '500'] },
  '/v1/auth/sign-in/verify': { post: ['200', '400', '409', '429', '500'] },
} as const
```

Also assert OpenAPI `3.1.0`, component `Error`, and the exact request-schema required/nullable rules already exercised by the endpoint tests.

- [ ] **Step 6: Run Task 1 gates and review**

Run:

```bash
npm test
npm run check
git diff --check
```

Expected: 45 preserved tests plus the new OpenAPI test pass. Request an independent review of the Task 1 diff and resolve every Critical or Important finding.

- [ ] **Step 7: Commit Task 1**

```bash
git add apps/api/package.json apps/api/test docs/logs/20260811225753-migrate-api-feature-modules
git commit -m "test: preserve API migration baseline"
```

---

### Task 2: Move shared HTTP, health, config, and observability boundaries

**Files:**
- Create: `apps/api/src/shared/http/types.ts`
- Move: `apps/api/src/contracts/error.ts` → `apps/api/src/shared/http/error-contract.ts`
- Create: `apps/api/src/modules/health/contracts.ts`
- Create: `apps/api/src/modules/health/routes/health.ts`
- Create: `apps/api/src/modules/health/index.ts`
- Move: `apps/api/src/config.ts` → `apps/api/src/infrastructure/config/index.ts`
- Move: `apps/api/src/observability/logger.ts` → `apps/api/src/infrastructure/observability/logger.ts`
- Move: `apps/api/src/observability/request-middleware.ts` → `apps/api/src/infrastructure/observability/request-middleware.ts`
- Move: `apps/api/src/observability/sentry.ts` → `apps/api/src/infrastructure/observability/sentry.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/instrument.ts`
- Modify: `apps/api/src/index.ts`
- Modify: affected tests under `apps/api/test/`

**Interfaces:**
- Consumes: Existing error schema, App variables, health contract, config loaders, logger/Sentry functions.
- Produces:

```ts
export type AppVariables = { requestId: string; logger: Logger }
export type App = OpenAPIHono<{ Variables: AppVariables }>
export function registerHealthRoutes(): App
```

- [ ] **Step 1: Point boundary tests at the target modules**

Update app, config, and observability test imports to the target paths and add a health aggregate assertion:

```ts
const routes = registerHealthRoutes()
const response = await routes.request('/health')
assert.equal(response.status, 200)
```

Run the targeted tests and confirm they fail with target modules unresolved.

```bash
node --import tsx --test test/app.test.ts test/config.test.ts test/infrastructure/observability/request-middleware.test.ts
```

- [ ] **Step 2: Create shared Hono and error contracts**

`shared/http/types.ts` exports the typed `App`; `error-contract.ts` exports the existing `errorSchema`. Feature routes import these inward contracts rather than `src/app.ts`.

- [ ] **Step 3: Extract the health module**

Use `healthResponseSchema`, exported `healthRoute`, and `registerHealthRoute`; return a completed child app from `registerHealthRoutes()`:

```ts
export function registerHealthRoutes(): App {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  registerHealthRoute(app)
  return app
}
```

Keep the route path `/health` until Task 6 mounts the completed child at `/`.

- [ ] **Step 4: Move config and observability implementations**

Preserve exported function names and current values:

```ts
loadDatabaseConfig(env)
loadCognitoConfig(env)
loadObservabilityConfig(env)
createLogger(config, destination?)
createRequestLoggerMiddleware(logger)
setRequestIdTag(requestId)
closeSentry()
```

Update `instrument.ts`, `app.ts`, `index.ts`, and tests to import the infrastructure paths.

- [ ] **Step 5: Register health through the module boundary**

Keep `createApp(dependencies, registerRoutes?)` compatible for the remaining auth migration, register the completed health child from the app factory, and retain top-level `defaultHook`, middleware, `notFound`, `onError`, and OpenAPI metadata.

- [ ] **Step 6: Run Task 2 gates and review**

```bash
node --import tsx --test test/app.test.ts test/config.test.ts test/infrastructure/observability/request-middleware.test.ts
npm test
npm run check
git diff --check
```

Expected: public health/OpenAPI/error/request-ID tests and all baseline names pass. Request independent review and resolve all Critical or Important findings.

- [ ] **Step 7: Commit Task 2**

```bash
git add apps/api/src apps/api/test docs/logs/20260811225753-migrate-api-feature-modules
git commit -m "refactor: extract API platform boundaries"
```

---

### Task 3: Introduce the Owner module and Drizzle repository

**Files:**
- Create: `apps/api/src/modules/owners/types.ts`
- Create: `apps/api/src/modules/owners/repository.ts`
- Create: `apps/api/src/modules/owners/index.ts`
- Move: `apps/api/src/schema/owner.ts` → `apps/api/src/infrastructure/database/schema/owner.ts`
- Move: `apps/api/src/db/client.ts` → `apps/api/src/infrastructure/database/client.ts`
- Create: `apps/api/src/infrastructure/database/repositories/drizzle-owner-repository.ts`
- Modify: `apps/api/src/auth/owner.ts` as a temporary compatibility caller for verification routes
- Modify: `apps/api/drizzle.config.ts`
- Create: `apps/api/test/infrastructure/database/drizzle-owner-repository.test.ts`
- Create: `apps/api/test/infrastructure/database/drizzle-owner-repository.integration.ts`
- Modify: `apps/api/test/infrastructure/database/owner-schema.test.ts`
- Modify: `apps/api/test/modules/auth/fixtures.ts`

**Interfaces:**
- Consumes: Current `owners` table and `DbInstance`.
- Produces:

```ts
export type Owner = {
  ownerId: string
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface OwnerRepository {
  resolveByCognitoSubject(cognitoSubject: string): Promise<Owner>
}

export function createDrizzleOwnerRepository(database: DbInstance): OwnerRepository
```

- [ ] **Step 1: Write failing repository unit tests**

Use a small transaction fake and assert:

```ts
assert.deepEqual(await repository.resolveByCognitoSubject('subject-1'), expectedOwner)
assert.deepEqual(calls, ['transaction', 'insert'])
```

Add the conflict branch assertion `['transaction', 'insert', 'select']`, exact insert values `{ cognitoSubject, displayName: null }`, mapper output with `avatarUrl: null`, and unexpected query error identity propagation. Run the suite and confirm the target repository module is unresolved.

- [ ] **Step 2: Move the Drizzle schema and client**

Update the schema import in `client.ts` and set Drizzle Kit to:

```ts
schema: './src/infrastructure/database/schema/*.ts'
```

Run `npm run db:generate`, then verify that the generated migration tree remains equal to the committed migration tree with `git diff --exit-code -- drizzle`.

- [ ] **Step 3: Implement the Owner interface and repository**

Inside one `database.transaction()`, insert with targeted conflict handling, return the inserted row when present, otherwise select by `owners.cognitoSubject` with `limit(1)`. Keep row-to-Owner conversion private to the repository.

- [ ] **Step 4: Route current verification through the repository**

Keep the current verification-route signature for this Task. Rewrite the temporary `ownerFromCognitoSubject(database, subject)` helper to call `createDrizzleOwnerRepository(database).resolveByCognitoSubject(subject)` and update response serialization to accept the module `Owner`.

- [ ] **Step 5: Add the real PostgreSQL concurrency test**

Use a unique `cognitoSubject`, call `resolveByCognitoSubject` concurrently twice, and assert the same `ownerId` and one matching database row. Delete only the generated subject row in test cleanup.

Run local PostgreSQL, migration, and integration test:

```bash
docker compose --env-file ../.env.local -f ../compose.yml up -d postgres
POSTGRES_HOST=127.0.0.1 npm run migrate
POSTGRES_HOST=127.0.0.1 npm run test:integration
```

- [ ] **Step 6: Run Task 3 gates and review**

```bash
node --import tsx --test test/infrastructure/database/owner-schema.test.ts test/infrastructure/database/drizzle-owner-repository.test.ts test/modules/auth/routes/sign-up-verify.test.ts test/modules/auth/routes/sign-in-verify.test.ts
npm test
npm run check
git diff --check
```

Expected: insert/existing branches, schema assertions, and existing authentication responses pass. Request independent review and resolve all Critical or Important findings.

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/api/src apps/api/test apps/api/drizzle.config.ts docs/logs/20260811225753-migrate-api-feature-modules
git commit -m "refactor: add Owner repository boundary"
```

---

### Task 4: Migrate Sign Up and Sign In start slices

**Files:**
- Create: `apps/api/src/modules/auth/types.ts`
- Create: `apps/api/src/modules/auth/errors.ts`
- Create: `apps/api/src/modules/auth/provider.ts`
- Create: `apps/api/src/modules/auth/contracts.ts`
- Create: `apps/api/src/modules/auth/use-cases/start-sign-up.ts`
- Create: `apps/api/src/modules/auth/use-cases/start-sign-in.ts`
- Move/refactor: `apps/api/src/routes/sign-up.ts` → `apps/api/src/modules/auth/routes/sign-up.ts`
- Move/refactor: `apps/api/src/routes/sign-in.ts` → `apps/api/src/modules/auth/routes/sign-in.ts`
- Move: `apps/api/src/auth/cognito.ts` → `apps/api/src/infrastructure/cognito/client.ts`
- Create: `apps/api/src/infrastructure/cognito/cognito-auth-provider.ts`
- Modify: `apps/api/src/routes/index.ts` as the temporary full-path aggregator
- Create: `apps/api/test/modules/auth/use-cases/start-sign-up.test.ts`
- Create: `apps/api/test/modules/auth/use-cases/start-sign-in.test.ts`
- Create: `apps/api/test/infrastructure/cognito/cognito-auth-provider.test.ts`
- Modify: start-route tests and auth fixtures

**Interfaces:**
- Consumes: Existing Cognito client methods and exact Sign Up/Sign In HTTP contracts.
- Produces:

```ts
export type AuthFailure =
  | 'invalid-input'
  | 'already-confirmed'
  | 'authentication-failed'
  | 'rate-limited'
  | 'code-expired'
  | 'invalid-code'
  | 'code-already-used'

export interface AuthProvider {
  signUp(email: string): Promise<SignUpProviderResult>
  resendSignUpCode(email: string): Promise<ResendSignUpCodeProviderResult>
  startSignIn(email: string, session?: string): Promise<StartSignInProviderResult>
}

export type StartSignUp = (input: { email: string }) => Promise<StartSignUpResult>
export type StartSignIn = (input: { email: string }) => Promise<StartSignInResult>
```

- [ ] **Step 1: Write failing use-case tests**

For Sign Up, assert direct challenge success, `username-exists` followed by resend, already-confirmed result, invalid input, rate limit, dependency order, and unexpected error identity. For Sign In, assert EMAIL_OTP challenge conversion, authentication failure, rate limit, incomplete challenge as an internal failure, and unexpected error identity.

```ts
const result = await createStartSignUp(provider)({ email: 'test@example.com' })
assert.deepEqual(result, expectedChallenge)
assert.deepEqual(calls, ['signUp:test@example.com'])
```

- [ ] **Step 2: Define auth contracts, types, errors, and start use cases**

Move the current Zod request/response schemas into `contracts.ts`. Use cases return discriminated module results. Exact status, message, request ID, and retryability stay in endpoint routes.

- [ ] **Step 3: Write failing Cognito adapter command/result tests**

Use a recording sender/gateway and assert `SignUpCommand`, `ResendConfirmationCodeCommand`, and `InitiateAuthCommand` inputs exactly. Assert PascalCase SDK output conversion, each documented exception result, and unexpected error identity propagation.

- [ ] **Step 4: Implement the Cognito start-operation adapter**

Keep `createCognitoClient(config)` and its current method assertions in infrastructure. `createCognitoAuthProvider(cognitoClient)` implements module result conversion and imports AWS types only under `infrastructure/cognito`.

- [ ] **Step 5: Refactor the two start routes**

Each handler reads `c.req.valid('json')`, calls its injected use case once, and maps the result to the existing response. Keep full public paths during this Task so the current root aggregator remains valid:

```ts
export function registerSignUpRoute(app: App, startSignUp: StartSignUp): void
export function registerSignInRoute(app: App, startSignIn: StartSignIn): void
```

Route tests inject only these functions and assert their received input. Invalid JSON completes at the validation response, demonstrated by an empty use-case call log.

- [ ] **Step 6: Run Task 4 gates and review**

```bash
node --import tsx --test test/modules/auth/routes/sign-up.test.ts test/modules/auth/routes/sign-in.test.ts test/modules/auth/use-cases/start-sign-up.test.ts test/modules/auth/use-cases/start-sign-in.test.ts test/infrastructure/cognito/client.test.ts test/infrastructure/cognito/cognito-auth-provider.test.ts
npm test
npm run check
git diff --check
```

Expected: current Sign Up/Sign In HTTP assertions plus new use-case/adapter boundaries pass. Request independent review and resolve all Critical or Important findings.

- [ ] **Step 7: Commit Task 4**

```bash
git add apps/api/src apps/api/test docs/logs/20260811225753-migrate-api-feature-modules
git commit -m "refactor: extract authentication start slices"
```

---

### Task 5: Migrate Sign Up Verify and Sign In Verify slices

**Files:**
- Extend: `apps/api/src/modules/auth/provider.ts`
- Create: `apps/api/src/modules/auth/use-cases/verify-sign-up.ts`
- Create: `apps/api/src/modules/auth/use-cases/verify-sign-in.ts`
- Move/refactor: `apps/api/src/routes/sign-up-verify.ts` → `apps/api/src/modules/auth/routes/sign-up-verify.ts`
- Move/refactor: `apps/api/src/routes/sign-in-verify.ts` → `apps/api/src/modules/auth/routes/sign-in-verify.ts`
- Extend: `apps/api/src/infrastructure/cognito/cognito-auth-provider.ts`
- Modify: `apps/api/src/routes/index.ts`
- Remove after consumers move: `apps/api/src/auth/contracts.ts`, `apps/api/src/auth/owner.ts`
- Create: `apps/api/test/modules/auth/use-cases/verify-sign-up.test.ts`
- Create: `apps/api/test/modules/auth/use-cases/verify-sign-in.test.ts`
- Extend: `apps/api/test/infrastructure/cognito/cognito-auth-provider.test.ts`
- Modify: verify-route tests and auth fixtures

**Interfaces:**
- Consumes: `OwnerRepository`, current confirm/challenge Cognito methods, authentication response contract.
- Produces:

```ts
export type Authentication = {
  subject: string
  accessToken: string
  idToken: string
  refreshToken: string
}

export interface AuthProvider {
  // Task 4 operations
  verifySignUp(input: { username: string; session: string | null; code: string }): Promise<VerifyProviderResult>
  verifySignIn(input: { username: string; session: string; code: string }): Promise<VerifyProviderResult>
}

export type VerifySignUp = (input: VerifySignUpInput) => Promise<VerifyAuthResult>
export type VerifySignIn = (input: VerifySignInInput) => Promise<VerifyAuthResult>
```

- [ ] **Step 1: Write failing verify use-case tests**

For each use case, assert provider input, authenticated result → Owner resolution by `subject`, complete tokens and Owner output, every known provider failure, a provider-only call log for failure outcomes, and unexpected error identity propagation.

```ts
assert.deepEqual(calls, [
  'verifySignIn:test@example.com:sign-in-session:12345678',
  'resolveByCognitoSubject:test-cognito-sub',
])
```

- [ ] **Step 2: Extend Cognito adapter tests and implementation**

Assert exact `ConfirmSignUpCommand`, follow-up `InitiateAuthCommand`, and `RespondToAuthChallengeCommand` input. Require AccessToken, IdToken, and RefreshToken; decode the ID-token payload and require a string `sub`; return camelCase `Authentication`. Convert ExpiredCode, CodeMismatch, NotAuthorized, AliasExists, TooManyRequests, and LimitExceeded to documented module failures; propagate all other errors.

- [ ] **Step 3: Implement verify use cases**

Call provider once, resolve Owner only for `authenticated`, and return `{ outcome: 'authenticated', authentication, owner }`. Return known feature failures unchanged for route mapping.

- [ ] **Step 4: Refactor verify routes**

Use injected `VerifySignUp`/`VerifySignIn` functions. Preserve exact current messages, including:

```text
コードの有効期限が切れました。最初からやり直してください。
コードの有効期限が切れました。コードを再送してください。
コードが正しくありません。同じコードで再試行するか、最初からやり直してください。
認証情報の有効期限が切れました。コードを再送してください。
このアカウントは既に確認済みです。サインインしてください。
しばらく待ってから再試行してください。
認証情報の取得に失敗しました。
```

Keep full public paths through this Task. Route tests inject only the corresponding verify use case.

- [ ] **Step 5: Remove transitional auth helpers**

All authentication response schemas come from `modules/auth/contracts.ts`; token/Owner composition comes from use cases and route serialization. Production imports resolve through module or infrastructure paths.

- [ ] **Step 6: Run Task 5 gates and review**

```bash
node --import tsx --test test/modules/auth/routes/sign-up-verify.test.ts test/modules/auth/routes/sign-in-verify.test.ts test/modules/auth/use-cases/verify-sign-up.test.ts test/modules/auth/use-cases/verify-sign-in.test.ts test/infrastructure/cognito/cognito-auth-provider.test.ts test/infrastructure/database/drizzle-owner-repository.test.ts
npm test
npm run check
git diff --check
```

Expected: current verification contracts, added ordering/error coverage, and all baseline names pass. Request independent review and resolve all Critical or Important findings.

- [ ] **Step 7: Commit Task 5**

```bash
git add apps/api/src apps/api/test docs/logs/20260811225753-migrate-api-feature-modules
git commit -m "refactor: extract authentication verification slices"
```

---

### Task 6: Complete route aggregation, composition, lifecycle, and migration verification

**Files:**
- Create: `apps/api/src/modules/auth/routes/index.ts`
- Create: `apps/api/src/modules/auth/index.ts`
- Modify: all auth endpoint route paths from full paths to child-relative paths
- Modify: `apps/api/src/modules/health/index.ts`
- Modify: `apps/api/src/app.ts`
- Rewrite: `apps/api/src/index.ts` as an import-safe composition factory
- Rewrite: `apps/api/src/server.ts` as listener/signal/shutdown owner
- Modify: `apps/api/src/instrument.ts`
- Modify: `apps/api/package.json`, `apps/api/knip.json`
- Remove: `apps/api/src/routes/`, `apps/api/src/auth/`, `apps/api/src/db/`, `apps/api/src/contracts/`, `apps/api/src/observability/`, `apps/api/src/schema/`
- Create: `apps/api/test/modules/auth/auth-routes.test.ts`
- Create: `apps/api/test/composition.test.ts`
- Modify: `apps/api/test/app.test.ts`, `apps/api/test/openapi.test.ts`, `apps/api/test/server.test.ts`, fixtures/imports
- Update: session `completion-checklist.md`, `verification.md`, and `transcript.md`

**Interfaces:**
- Consumes: Completed auth/health routes, use cases, adapters, Owner repository, infrastructure config/resources.
- Produces:

```ts
export type AuthRouteDependencies = {
  startSignUp: StartSignUp
  verifySignUp: VerifySignUp
  startSignIn: StartSignIn
  verifySignIn: VerifySignIn
}
export function registerAuthRoutes(dependencies: AuthRouteDependencies): App

export type ModuleRoute = { path: string; app: App }
export function createApp(dependencies: AppDependencies, routes: ModuleRoute[]): App

export function createApplication(
  env: NodeJS.ProcessEnv,
  factories?: ApplicationFactories,
): { app: App; resources: ApplicationResources }
```

- [ ] **Step 1: Write failing aggregate and composition tests**

`auth-routes.test.ts` requests the child OpenAPI document or mounts it on a test parent and asserts exactly one operation for each relative/public method-path. `composition.test.ts` injects spy factories and asserts order and identity:

```ts
assert.deepEqual(calls, [
  'config', 'logger', 'database', 'cognito-client', 'auth-provider',
  'owner-repository', 'use-cases', 'auth-routes', 'health-routes', 'app',
])
assert.equal(receivedDatabase, database)
assert.equal(receivedCognitoClient, cognitoClient)
```

Importing `index.ts` performs module definition; listener, signal, PostgreSQL, and AWS construction begin when `createApplication` is invoked. Assert an empty factory call log immediately after import.

- [ ] **Step 2: Build completed auth and health child apps**

Change auth endpoint paths to `/sign-up`, `/sign-up/verify`, `/sign-in`, `/sign-in/verify`. Register every endpoint before returning the child app. Keep health at `/health` and mount it at `/`.

- [ ] **Step 3: Mount completed modules in app.ts**

Apply middleware and global hooks once, then mount:

```ts
for (const route of routes) {
  app.route(route.path, route.app)
}
```

Production supplies exactly `{ path: '/', app: healthRoutes }` and `{ path: '/v1/auth', app: authRoutes }`. Register OpenAPI document metadata after completed route registration so `/openapi.json` contains all operations.

- [ ] **Step 4: Implement the pure composition factory**

`createApplication(env, factories)` loads each config once, creates one logger, Pool/DB, and Cognito client, shares them with adapters/repository, constructs four use cases, constructs both feature apps, and returns the Hono app plus closeable resources. Default factories are production implementations; tests replace the complete factory set.

- [ ] **Step 5: Move process startup and lifecycle to server.ts**

Change package entry scripts to `src/server.ts` / `dist/server.js`. `server.ts` calls `createApplication(process.env)`, starts `serve`, registers SIGINT/SIGTERM, and uses an idempotent shutdown promise. Close order is listener → Pool → Cognito client → Sentry; every resource closes once, including the server-close error path.

- [ ] **Step 6: Remove transitional first-level directories and verify imports**

Run:

```bash
rg "src/(auth|routes|db|contracts|observability|schema)|from ['\"]\.\.?/(auth|routes|db|contracts|observability|schema)" src test
```

Expected: every production/test import resolves through `modules`, `infrastructure`, or `shared`. Confirm `drizzle.config.ts` points to `src/infrastructure/database/schema/*.ts` and `knip.json` entries include `src/server.ts` and recursive tests.

- [ ] **Step 7: Verify the public contract and full suite**

```bash
npm test
POSTGRES_HOST=127.0.0.1 npm run test:integration
npm run check
npm run build
../../scripts/agent-skills.sh check
git diff --check origin/main...HEAD
```

Expected:

- Every recorded baseline test name appears once and passes.
- New route/use-case/adapter/repository/aggregate/composition/server tests pass.
- `/health` and all four `/v1/auth` operations match the Task 1 characterization matrix.
- OpenAPI `3.1.0`, `Error`, request ID header, request schemas, and success/error statuses match.
- Integration, lint, jscpd, knip, typecheck, build, skill consistency, and diff checks succeed.

- [ ] **Step 8: Complete artifacts and independent review**

Record final test counts, integration result, quality-gate output, OpenAPI comparison, import-boundary result, and staged-plan classification in `verification.md`; mark every deliverable in `completion-checklist.md`; sync the transcript. Request an independent full-diff review and resolve every Critical or Important finding, rerunning the affected and full gates.

- [ ] **Step 9: Commit Task 6**

```bash
git add apps/api docs/logs/20260811225753-migrate-api-feature-modules
git commit -m "refactor: compose feature-first API"
```

## Plan self-review

- Spec coverage: public contract, source layout, dependency flow, error ownership, vertical sequence, test layout, official guidance, and all quality gates map to Tasks 1–6.
- Placeholder scan: every implementation step identifies concrete files, interfaces, commands, and expected results.
- Type consistency: `App`, `AuthProvider`, `OwnerRepository`, four use-case function types, `AuthRouteDependencies`, `ModuleRoute`, and `createApplication` are introduced before their consumers.
- Scope: the plan changes API organization and boundary coverage while preserving the active R1 product contract and release order.
