# R1 Step 1 Sign Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 認証済み Owner が `/settings` から Sign Out でき、API が Cognito session を無効化し、Active Walk がある場合は Failed にしたうえで `204` を返す。

**Architecture:** JIT で Cognito access token 検証 middleware を入れ、保護された `POST /v1/auth/sign-out` が `signOut` use case を一度呼ぶ。use case は Owner 解決、`ActiveWalkCommands.failIfPresent`、`AuthProvider.signOut` の順で処理する。モバイルは Settings 画面と確認ダイアログを持ち、`204` 後に Secure Store を空にして Sign In へ戻る。

**Tech Stack:** Hono、`@hono/zod-openapi`、Zod 4、`aws-jwt-verify`、AWS Cognito `GlobalSignOut`、Expo Router、Secure Store、Node.js test runner

## Global Constraints

- 公開契約は `docs/logs/20260812175057-r1-step1-sign-out/sign-out-specification.md` に従う。
- `POST /v1/auth/sign-out` は Access Token 必須、body の許容値は `{}` または省略、成功は `204 No Content`。
- Active Walk がある Sign Out は確認後に常に Failed。キャンセルは Walk と session を維持する。
- Settings は `/settings` で Sign Out と法務リンク（利用規約、プライバシーポリシー、アプリ情報）を提供する。
- 認証ゲート失敗は HTTP `401`、`code: "UNAUTHENTICATED"`、`message: "Authentication is required."`、`retryable: false`。
- feature-first 配置と命名: `sign-out.ts`、`signOutRoute`、`registerSignOutRoute`、`registerAuthRoutes`。
- use case は Hono / Zod / AWS SDK / Drizzle を import しない。
- collaborator は required 注入。Quiet no-op を production factory に埋めない。`failIfPresent` は明示実装を渡す。
- コマンドは指定がなければ `apps/api` または `apps/mobile` から実行する。
- 各 Task は targeted test → 関連 gate → commit。

## Task-to-design traceability

| Task | Design section | Deliverable | Acceptance condition |
| --- | --- | --- | --- |
| 1. Access token gate | WHAT 認証ゲート / HOW API verifier | `principal`、BearerAuth、middleware | 欠落・無効 token が `401 UNAUTHENTICATED` |
| 2. Sign-out ports | HOW AuthProvider / ActiveWalkCommands | `signOut`、`failIfPresent`、Cognito adapter、absent Active Walk 実装 | provider/unit tests が成功 |
| 3. Sign-out use case + route | HOW signOut use case / route | `POST /v1/auth/sign-out` | `204` と `401` の契約 test |
| 4. Composition + OpenAPI | HOW API composition | index wiring、OpenAPI path | OpenAPI と composition tests |
| 5. Mobile Settings | HOW モバイル | `/settings`、204 対応、home 入口 | Sign Out → Sign In |
| 6. iOS evidence | Verification | screenshots / session report | idle Settings と Sign In 復帰 |

---

### Task 1: Cognito access token verification middleware

**Files:**
- Modify: `apps/api/package.json` (add `aws-jwt-verify`)
- Modify: `apps/api/src/shared/http/types.ts`
- Create: `apps/api/src/infrastructure/cognito/access-token-verifier.ts`
- Create: `apps/api/src/shared/http/authentication-middleware.ts`
- Modify: `apps/api/src/app.ts` (register `BearerAuth` security scheme on OpenAPI registry)
- Test: `apps/api/test/infrastructure/cognito/access-token-verifier.test.ts`
- Test: `apps/api/test/shared/http/authentication-middleware.test.ts`

**Interfaces:**
- Consumes: Cognito config `{ region, userPoolId, clientId }`
- Produces:
  ```ts
  type Principal = { cognitoSubject: string }
  type AccessTokenVerifier = {
    verify(accessToken: string): Promise<Principal>
  }
  function createAccessTokenVerifier(config: {
    region: string
    userPoolId: string
    clientId: string
  }): AccessTokenVerifier
  function createAuthenticationMiddleware(
    verifier: AccessTokenVerifier,
  ): MiddlewareHandler<{ Variables: AppVariables }>
  ```
  `AppVariables` に `principal: Principal` を追加する。

- [x] **Step 1: Write failing middleware test**

```ts
test('returns 401 UNAUTHENTICATED when Authorization is missing', async () => {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  app.use('*', async (c, next) => {
    c.set('requestId', 'req-1')
    await next()
  })
  app.use('*', createAuthenticationMiddleware({
    verify: async () => {
      throw new Error('should not verify')
    },
  }))
  app.get('/protected', (c) => c.json({ ok: true }))
  const response = await app.request('/protected')
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    code: 'UNAUTHENTICATED',
    message: 'Authentication is required.',
    requestId: 'req-1',
    retryable: false,
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- test/shared/http/authentication-middleware.test.ts`  
Expected: FAIL (module missing)

- [x] **Step 3: Implement verifier + middleware**

- `Authorization: Bearer <token>` を読み、verifier に渡す。
- 欠落・非 Bearer・verify 失敗はすべて同じ `401 UNAUTHENTICATED`。
- 成功時 `c.set('principal', principal)` して `next()`。
- OpenAPI registry に `BearerAuth` (`type: http`, `scheme: bearer`, `bearerFormat: JWT`) を登録する。

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/shared/http/authentication-middleware.test.ts test/infrastructure/cognito/access-token-verifier.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json \
  apps/api/src/shared/http/types.ts \
  apps/api/src/shared/http/authentication-middleware.ts \
  apps/api/src/infrastructure/cognito/access-token-verifier.ts \
  apps/api/src/app.ts \
  apps/api/test/shared/http/authentication-middleware.test.ts \
  apps/api/test/infrastructure/cognito/access-token-verifier.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add Cognito access token authentication gate

EOF
)"
```

---

### Task 2: Sign-out provider and Active Walk command ports

**Files:**
- Modify: `apps/api/src/modules/auth/provider.ts`
- Modify: `apps/api/src/infrastructure/cognito/cognito-auth-provider.ts`
- Modify: `apps/api/src/infrastructure/cognito/client.ts` (add `globalSignOut`)
- Create: `apps/api/src/modules/walks/active-walk-commands.ts`
- Create: `apps/api/src/infrastructure/walks/absent-active-walk-commands.ts`
- Test: `apps/api/test/infrastructure/cognito/cognito-auth-provider-sign-out.test.ts`
- Test: `apps/api/test/infrastructure/walks/absent-active-walk-commands.test.ts`

**Interfaces:**
- Consumes: existing `CognitoClient`
- Produces:
  ```ts
  type SignOutProviderResult =
    | { outcome: 'signed-out' }
    | { outcome: 'authentication-failed' }
    | { outcome: 'rate-limited' }

  interface AuthProvider {
    // existing methods…
    signOut(accessToken: string): Promise<SignOutProviderResult>
  }

  interface ActiveWalkCommands {
    failIfPresent(input: { ownerId: string }): Promise<void>
  }

  function createAbsentActiveWalkCommands(): ActiveWalkCommands
  ```

- [x] **Step 1: Write failing provider and absent-commands tests**

```ts
test('signOut returns signed-out when Cognito GlobalSignOut succeeds', async () => {
  const client = {
    globalSignOut: async (accessToken: string) => {
      assert.equal(accessToken, 'access')
    },
  }
  const provider = createCognitoAuthProvider(client as CognitoClient)
  assert.deepEqual(await provider.signOut('access'), { outcome: 'signed-out' })
})

test('absent ActiveWalkCommands.failIfPresent resolves without work', async () => {
  const commands = createAbsentActiveWalkCommands()
  await commands.failIfPresent({ ownerId: 'owner-1' })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/infrastructure/cognito/cognito-auth-provider-sign-out.test.ts test/infrastructure/walks/absent-active-walk-commands.test.ts`  
Expected: FAIL

- [x] **Step 3: Implement client method, provider mapping, absent commands**

- Cognito: `GlobalSignOutCommand({ AccessToken })`
- Map `NotAuthorizedException` → `authentication-failed`
- Map rate-limit exceptions → `rate-limited`
- `createAbsentActiveWalkCommands().failIfPresent` は即座に resolve（Walk 未導入時の明示実装）

- [x] **Step 4: Run tests to verify they pass**

Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(api): add sign-out provider and absent Active Walk commands

EOF
)"
```

---

### Task 3: Sign-out use case and protected route

**Files:**
- Modify: `apps/api/src/modules/auth/types.ts`
- Modify: `apps/api/src/modules/auth/contracts.ts`
- Create: `apps/api/src/modules/auth/use-cases/sign-out.ts`
- Create: `apps/api/src/modules/auth/routes/sign-out.ts`
- Modify: `apps/api/src/modules/auth/routes/index.ts`
- Test: `apps/api/test/modules/auth/use-cases/sign-out.test.ts`
- Test: `apps/api/test/modules/auth/routes/sign-out.test.ts`

**Interfaces:**
- Consumes: `OwnerRepository.resolveByCognitoSubject`, `ActiveWalkCommands.failIfPresent`, `AuthProvider.signOut`, `principal` from middleware
- Produces:
  ```ts
  type SignOut = (input: {
    cognitoSubject: string
    accessToken: string
  }) => Promise<
    | { outcome: 'signed-out' }
    | { outcome: 'authentication-failed' }
    | { outcome: 'rate-limited' }
  >

  function createSignOut(
    ownerRepository: OwnerRepository,
    activeWalkCommands: ActiveWalkCommands,
    authProvider: AuthProvider,
  ): SignOut
  ```

  Route:
  - path `/sign-out`（mount 後 `/v1/auth/sign-out`）
  - `security: [{ BearerAuth: [] }]`
  - request body optional empty object schema `z.object({}).strict()` または body なし
  - success `204` empty
  - auth middleware を `/sign-out` にだけ適用（公開 sign-up/sign-in は非保護のまま）

- [x] **Step 1: Write failing use-case and route tests**

Use-case order assertion:

```ts
test('fails Active Walk then signs out Cognito', async () => {
  const calls: string[] = []
  const signOut = createSignOut(
    { resolveByCognitoSubject: async () => ({ id: 'owner-1', /* … */ }) },
    { failIfPresent: async ({ ownerId }) => {
      assert.equal(ownerId, 'owner-1')
      calls.push('fail')
    } },
    { signOut: async (token) => {
      assert.equal(token, 'access')
      calls.push('cognito')
      return { outcome: 'signed-out' }
    } },
  )
  assert.deepEqual(
    await signOut({ cognitoSubject: 'sub-1', accessToken: 'access' }),
    { outcome: 'signed-out' },
  )
  assert.deepEqual(calls, ['fail', 'cognito'])
})
```

Route:

```ts
test('POST /v1/auth/sign-out returns 204', async () => {
  const response = await app.request('/v1/auth/sign-out', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer access',
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
})
```

Also cover missing bearer → `401` without calling use case.

- [x] **Step 2: Run tests to verify they fail**

Expected: FAIL

- [x] **Step 3: Implement use case and route**

Required skills before editing:
- `implementing-api-use-cases`
- `routing-hono-apis`
- `documenting-hono-openapi`
- `validating-hono-requests`
- `defining-zod-schemas`（request schema を触る場合）

`registerAuthRoutes` は verifier を required で受け取り、`app.use('/sign-out', createAuthenticationMiddleware(verifier))` の後に `registerSignOutRoute` する。

- [x] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/modules/auth/use-cases/sign-out.test.ts test/modules/auth/routes/sign-out.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(api): add signed-out use case and protected sign-out route

EOF
)"
```

---

### Task 4: Composition root and OpenAPI characterization

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/modules/auth/index.ts`（依存型の再エクスポート）
- Modify: `apps/api/test/openapi.test.ts`
- Modify: `apps/api/test/composition.test.ts`
- Modify: `apps/api/test/modules/auth/auth-routes.test.ts`（path 一覧）
- Modify: `apps/api/test/modules/auth/fixtures.ts`

**Interfaces:**
- Consumes: Task 1–3 outputs
- Produces: production graph
  ```ts
  createUseCases({
    authProvider,
    ownerRepository,
    activeWalkCommands,
  }): AuthRouteDependencies & { signOut: SignOut; accessTokenVerifier: AccessTokenVerifier }
  ```
  Composition は `createAbsentActiveWalkCommands()` と `createAccessTokenVerifier(cognitoConfig)` を明示生成して渡す。

- [x] **Step 1: Extend OpenAPI expected maps**

```ts
'/v1/auth/sign-out': { post: ['204', '400', '401', '429', '500'] }
```

Assert `security` includes BearerAuth on sign-out and remains absent on public auth routes.

- [x] **Step 2: Run OpenAPI test to verify it fails**

Expected: FAIL (path missing)

- [x] **Step 3: Wire composition and fixtures**

Update every `registerAuthRoutes(...)` call site to pass verifier + `signOut`.

- [x] **Step 4: Run full API tests and check**

```bash
npm test
npm run check
```

Expected: all pass; OpenAPI includes `/v1/auth/sign-out`.

- [x] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(api): compose sign-out dependencies and OpenAPI contract

EOF
)"
```

---

### Task 5: Mobile Settings and Sign Out client

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`（`204` 空 body を成功として扱う）
- Create: `apps/mobile/src/app/(app)/settings.tsx`
- Modify: `apps/mobile/src/app/(app)/index.tsx`（Settings への入口）
- Create: `apps/mobile/src/lib/active-walk.ts`（現状 `hasActiveWalk(): false` を返す明示実装）
- Test / typecheck via package scripts available in mobile

**Interfaces:**
- Consumes: `useAuth().session` / `clearSession`, `apiRequest`
- Produces:
  ```ts
  async function signOutRequest(accessToken: string): Promise<void>
  function hasActiveWalk(): boolean // current implementation returns false
  ```

- [x] **Step 1: Fix api client for 204**

```ts
if (response.status === 204) {
  return undefined as T
}
```

Do this before JSON parse.

- [x] **Step 2: Implement Settings screen**

States: idle / confirm / loading / error.  
Events from specification:
- legal links → `https://cacheandbuffer.com/`
- Sign Out + `hasActiveWalk() === false` → API
- Sign Out + `hasActiveWalk() === true` → `Alert` confirm
- confirm → API
- cancel → idle
- success → `clearSession()`
- failure → error message, retryable Sign Out

- [x] **Step 3: Add home navigation to Settings**

Authenticated home shows a control that routes to `/settings`.

- [x] **Step 4: Verify mobile typecheck / lint if available**

Run from `apps/mobile`: package scripts for typecheck/lint that exist.  
Expected: pass for changed files.

- [x] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mobile): add Settings Sign Out flow

EOF
)"
```

---

### Task 6: iOS evidence and session verification record

**Files:**
- Create: `docs/logs/20260812175057-r1-step1-sign-out/e2e-report.md`
- Create: `docs/logs/20260812175057-r1-step1-sign-out/screenshots/`（idle Settings、Sign Out 後 Sign In）
- Modify: session transcript / verification notes

**Interfaces:**
- Consumes: local API + Cognito + signed-in mobile session
- Produces: screenshots and short e2e report

- [x] **Step 1: Sign in on simulator/device against local API**

- [x] **Step 2: Open Settings, capture SETTINGS-01**

- [x] **Step 3: Sign Out, capture AUTH-01 after success**

- [x] **Step 4: Write e2e-report.md with commands, result, screenshot paths**

- [x] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs: record Sign Out iOS evidence

EOF
)"
```

---

## Self-review

1. Spec coverage: token gate, always-Failed Active Walk port, no `discardActiveWalk`, `/settings`, confirm dialog, `204`, mobile clear session, evidence — all mapped to Tasks 1–6.
2. Placeholder scan: none intentional; absent Active Walk is an explicit named implementation.
3. Type consistency: `SignOut`, `ActiveWalkCommands.failIfPresent`, `AccessTokenVerifier.verify`, `Principal.cognitoSubject` used consistently across tasks.
