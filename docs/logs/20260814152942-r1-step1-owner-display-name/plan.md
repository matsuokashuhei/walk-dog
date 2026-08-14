# R1 Step 1 Owner Display Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 認証済み Owner が `/owner/display-name` で表示名を登録でき、API が `GET /v1/owner` と `PATCH /v1/owner` で Owner を返す。

**Architecture:** `owners` module が BearerAuth 付き GET/PATCH を `/v1/owner` に載せる。GET は既存の `resolveByCognitoSubject`、PATCH は `updateDisplayName` を使う。モバイルはセッション時に GET で照合し、未設定なら登録画面、設定済みならホームを出す。

**Tech Stack:** Hono、`@hono/zod-openapi`、Zod 4、Drizzle、Expo Router、Secure Store、Node.js test runner

**Spec:** `docs/logs/20260814152942-r1-step1-owner-display-name/design.md`、`owner-display-name-api-spec.html`、`owner-display-name-spec-mockups.html`

## Global Constraints

- 公開契約は `owner-display-name-api-spec.html` と `owner-display-name-spec-mockups.html` に従う。
- `GET /v1/owner` と `PATCH /v1/owner` は Access Token 必須。成功は 200 と Owner リソース（`requestId`, `ownerId`, `displayName`, `avatarUrl`, `createdAt`, `updatedAt`）。
- PATCH body は `{ displayName }` のみ。`displayName` は `z.string().trim().nonempty().max(100)`。
- 認証ゲート失敗は HTTP `401`、`code: "UNAUTHENTICATED"`、`message: "Authentication is required."`、`retryable: false`。
- 入力不正は HTTP `400`、`code: "INVALID_INPUT"`、`message: "入力内容を確認してください。"`、`retryable: false`。
- use case は Hono / Zod / AWS SDK / Drizzle を import しない。
- collaborator は required 注入。Quiet no-op を production factory に埋めない。
- モバイル HTTP は `lib/owner-api.ts`。画面は `apiRequest` を直接呼ばない。
- コマンドは指定がなければ `apps/api` または `apps/mobile` から実行する。
- 各 Task は targeted test → 関連 gate → commit。

## Task-to-design traceability

| Task | Design section | Deliverable | Acceptance condition |
| --- | --- | --- | --- |
| 1. Repository update | HOW `updateDisplayName` | Drizzle update + unit tests | 保存した displayName を Owner として返す |
| 2. Owner routes | HOW GET/PATCH / Zod | `GET` / `PATCH /v1/owner` | 200 / 400 / 401 の契約テスト |
| 3. Composition | HOW mount | `index.ts` 配線、OpenAPI | `/openapi.json` に両 path |
| 4. Mobile gate + screen | HOW モバイル | `owner-api`、登録画面、layout ゲート | 未設定→登録、成功→ホーム |
| 5. iOS evidence | Verification | screenshots / e2e-report | 登録画面、入力エラー、ホーム |

---

### Task 1: OwnerRepository.updateDisplayName

**Files:**
- Modify: `apps/api/src/modules/owners/repository.ts`
- Modify: `apps/api/src/infrastructure/database/repositories/drizzle-owner-repository.ts`
- Test: `apps/api/test/infrastructure/database/drizzle-owner-repository.test.ts`

**Interfaces:**
- Consumes: existing `Owner`, `resolveByCognitoSubject`
- Produces:
  ```ts
  export interface OwnerRepository {
    resolveByCognitoSubject(cognitoSubject: string): Promise<Owner>
    updateDisplayName(cognitoSubject: string, displayName: string): Promise<Owner>
  }
  ```

- [ ] **Step 1: Write failing repository test**

既存 fake に `update` / `set` / `where` / `returning` を足し、次を追加する。

```ts
test('updateDisplayName returns the updated owner', async () => {
  const updatedRow = {
    ...insertedRow,
    displayName: 'Akira',
    updatedAt: new Date('2026-08-14T06:40:11.000Z'),
  }
  const { database, updateSets, updateTargets } = createDatabaseFake({
    updateResult: [updatedRow],
  })
  const repository = createDrizzleOwnerRepository(database)

  assert.deepEqual(await repository.updateDisplayName('subject-1', 'Akira'), {
    ownerId: updatedRow.ownerId,
    displayName: 'Akira',
    avatarUrl: null,
    createdAt,
    updatedAt: updatedRow.updatedAt,
  })
  assert.deepEqual(updateSets, [{ displayName: 'Akira' }])
  assert.equal(updateTargets.length, 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --import tsx --test test/infrastructure/database/drizzle-owner-repository.test.ts`

Expected: FAIL（`updateDisplayName` 未定義）

- [ ] **Step 3: Implement updateDisplayName**

```ts
updateDisplayName(cognitoSubject: string, displayName: string): Promise<Owner> {
  return database
    .update(owners)
    .set({ displayName })
    .where(eq(owners.cognitoSubject, cognitoSubject))
    .returning()
    .then((rows) => toOwner(rows[0]))
}
```

`updatedAt` は schema の `$onUpdate` に任せる。

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && node --import tsx --test test/infrastructure/database/drizzle-owner-repository.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/owners/repository.ts \
  apps/api/src/infrastructure/database/repositories/drizzle-owner-repository.ts \
  apps/api/test/infrastructure/database/drizzle-owner-repository.test.ts
git commit -m "feat(api): update owner display name in repository"
```

---

### Task 2: GET and PATCH /v1/owner

**Files:**
- Create: `apps/api/src/modules/owners/contracts.ts`
- Create: `apps/api/src/modules/owners/types.ts` に use case 型を追加（既存 Owner 型は維持）
- Create: `apps/api/src/modules/owners/use-cases/get-owner.ts`
- Create: `apps/api/src/modules/owners/use-cases/update-owner-display-name.ts`
- Create: `apps/api/src/modules/owners/routes/get-owner.ts`
- Create: `apps/api/src/modules/owners/routes/update-owner.ts`
- Create: `apps/api/src/modules/owners/routes/index.ts`
- Modify: `apps/api/src/modules/owners/index.ts`
- Modify: `apps/api/src/modules/auth/contracts.ts`（Owner リソース schema を owners から import）
- Test: `apps/api/test/modules/owners/use-cases/get-owner.test.ts`
- Test: `apps/api/test/modules/owners/use-cases/update-owner-display-name.test.ts`
- Test: `apps/api/test/modules/owners/routes/get-owner.test.ts`
- Test: `apps/api/test/modules/owners/routes/update-owner.test.ts`

**Interfaces:**
- Consumes: `OwnerRepository`, `createAuthenticationMiddleware`
- Produces:
  ```ts
  type OwnerHttp = {
    requestId: string
    ownerId: string
    displayName: string | null
    avatarUrl: string | null
    createdAt: string
    updatedAt: string
  }
  type GetOwner = (input: { cognitoSubject: string; requestId: string }) => Promise<OwnerHttp>
  type UpdateOwnerDisplayName = (input: {
    cognitoSubject: string
    requestId: string
    displayName: string
  }) => Promise<OwnerHttp>
  function registerOwnerRoutes(dependencies: {
    getOwner: GetOwner
    updateOwnerDisplayName: UpdateOwnerDisplayName
    accessTokenVerifier: AccessTokenVerifier
  }): App
  ```

  PATCH schema:

  ```ts
  export const updateOwnerRequestSchema = z.strictObject({
    displayName: z.string().trim().nonempty().max(100),
  })
  ```

  Route path は `/`。method は `get` と `patch`。`security: [{ BearerAuth: [] }]`。tags は `['owners']`。

- [ ] **Step 1: Write failing GET 401 / 200 route tests**

auth の `createAuthApp` と同じ `createApp` 組み立てで `{ path: '/v1/owner', app }` を mount する fixture を `test/modules/owners/fixtures.ts` に置く。

```ts
test('GET /v1/owner returns 401 without Authorization', async () => {
  const response = await createOwnerApp(deps).request('/v1/owner', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  assert.equal(response.status, 401)
  assert.equal((await response.json() as { code: string }).code, 'UNAUTHENTICATED')
})

test('GET /v1/owner returns 200 owner', async () => {
  const response = await createOwnerApp(deps).request('/v1/owner', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer access' },
  })
  assert.equal(response.status, 200)
  const body = await response.json() as { displayName: string | null; ownerId: string }
  assert.equal(body.displayName, null)
  assert.ok(body.ownerId)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && node --import tsx --test test/modules/owners/routes/get-owner.test.ts`

Expected: FAIL（module / route 未作成）

- [ ] **Step 3: Implement contracts, use cases, routes**

GET handler は `getOwner({ cognitoSubject: ctx.get('principal').cognitoSubject, requestId: ctx.get('requestId') })`。PATCH は `ctx.req.valid('json').displayName` を use case へ渡す。child app で `app.use('*', createAuthenticationMiddleware(verifier))` のあと両 route を登録する。

- [ ] **Step 4: Write PATCH 200 / 400 tests and implement**

```ts
test('PATCH /v1/owner returns 400 for empty displayName', async () => {
  const response = await createOwnerApp(deps).request('/v1/owner', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer access',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName: '   ' }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT')
})

test('PATCH /v1/owner returns 200 with trimmed displayName', async () => {
  const response = await createOwnerApp(deps).request('/v1/owner', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer access',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName: '  Akira  ' }),
  })
  assert.equal(response.status, 200)
  assert.equal((await response.json() as { displayName: string }).displayName, 'Akira')
})
```

- [ ] **Step 5: Run owner module tests**

Run: `cd apps/api && node --import tsx --test test/modules/owners/`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/owners apps/api/src/modules/auth/contracts.ts apps/api/test/modules/owners
git commit -m "feat(api): add GET and PATCH /v1/owner"
```

---

### Task 3: Compose owner routes

**Files:**
- Modify: `apps/api/src/index.ts`
- Test: 既存 composition / OpenAPI テストがあれば拡張。無ければ `apps/api/test/app-openapi.test.ts` 相当を探して `GET /v1/owner` と `PATCH /v1/owner` を追加する。

**Interfaces:**
- Consumes: `registerOwnerRoutes`, `OwnerRepository`, `AccessTokenVerifier`
- Produces: `{ path: '/v1/owner', app: ownerRoutes }` を `createApp` の routes 配列へ追加

- [ ] **Step 1: Write failing OpenAPI path assertion**

既存の OpenAPI テストに次を足す。ファイルが無ければ `apps/api/test/openapi.test.ts` を作成する。

```ts
test('OpenAPI documents GET and PATCH /v1/owner', async () => {
  const { app } = createApplication(env, factories)
  const response = await app.request('/openapi.json')
  const doc = await response.json() as { paths: Record<string, unknown> }
  assert.ok(doc.paths['/v1/owner'])
  assert.ok((doc.paths['/v1/owner'] as { get?: unknown; patch?: unknown }).get)
  assert.ok((doc.paths['/v1/owner'] as { get?: unknown; patch?: unknown }).patch)
})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL（path 未 mount）

- [ ] **Step 3: Wire composition**

`createUseCases` に `getOwner` と `updateOwnerDisplayName` を足す。`createOwnerRoutes` factory を追加し、routes 配列へ `{ path: '/v1/owner', app: ownerRoutes }` を入れる。Auth の unused 依存は増やさない。

- [ ] **Step 4: Run OpenAPI and owner tests**

Run: `cd apps/api && npm run check`

Expected: PASS（lint / jscpd / knip / typecheck）

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts apps/api/test
git commit -m "feat(api): mount owner routes on /v1/owner"
```

---

### Task 4: Mobile registration screen and gate

**Files:**
- Create: `apps/mobile/src/lib/owner-api.ts`
- Create: `apps/mobile/src/lib/owner.tsx`（Owner 取得状態。HTTP は `owner-api.ts` のみ）
- Create: `apps/mobile/src/app/(app)/owner/display-name.tsx`
- Modify: `apps/mobile/src/app/(app)/_layout.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`（OwnerProvider を session 配下で包む）
- Test: モバイルに既存の component test runner があれば登録画面の状態を足す。無ければ iOS E2E（Task 5）を画面検証の正本にする。

**Interfaces:**
- Consumes: `apiRequest`, `useAuth().session`
- Produces:
  ```ts
  type OwnerResponse = {
    requestId: string
    ownerId: string
    displayName: string | null
    avatarUrl: string | null
    createdAt: string
    updatedAt: string
  }
  function getOwner(accessToken: string): Promise<OwnerResponse>
  function updateOwnerDisplayName(
    accessToken: string,
    displayName: string,
  ): Promise<OwnerResponse>
  ```

- [ ] **Step 1: Add owner-api helpers**

`getOwner` は `GET /v1/owner`、`updateOwnerDisplayName` は `PATCH /v1/owner` で `{ displayName }` を送る。

- [ ] **Step 2: Add OwnerProvider**

session があるとき `getOwner` を呼ぶ。取得中は既存 auth と同じ `ActivityIndicator`。`displayName` を保持し、PATCH 成功後に同じ状態を更新する。

- [ ] **Step 3: Add `/owner/display-name` screen**

モック NAME-01〜05 に合わせる。`testID`: `display-name-root`、`display-name-input`、`display-name-submit`、`display-name-error`、`display-name-settings`。送信中は入力とボタンを無効化する。400 は「表示名は1〜100文字で入力してください。」、その他は API `message` または「登録に失敗しました。再試行してください。」。Settings は `router.push('/settings')`。

- [ ] **Step 4: Gate authenticated stack**

`displayName === null` のとき登録画面を出し、ホームは出さない。`displayName` があるときホームを出す。Settings はどちらでも出す。

- [ ] **Step 5: Typecheck mobile**

Run: `cd apps/mobile && npx tsc --noEmit`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/owner-api.ts apps/mobile/src/lib/owner.tsx \
  apps/mobile/src/app/(app)/owner/display-name.tsx \
  apps/mobile/src/app/(app)/_layout.tsx apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): gate signed-in owners on display name registration"
```

---

### Task 5: iOS E2E evidence

**Files:**
- Create: `docs/logs/20260814152942-r1-step1-owner-display-name/screenshots/ios-display-name-idle.png`
- Create: `docs/logs/20260814152942-r1-step1-owner-display-name/screenshots/ios-display-name-invalid.png`
- Create: `docs/logs/20260814152942-r1-step1-owner-display-name/screenshots/ios-display-name-home.png`
- Create: `docs/logs/20260814152942-r1-step1-owner-display-name/e2e-report.md`

**Interfaces:**
- Consumes: local API、Cognito OTP、iPhone simulator development client
- Produces: 登録画面、入力エラー、成功後ホームの PNG とレポート

- [ ] **Step 1: Run Sign In through OTP**

未設定 Owner で `/owner/display-name`（NAME-01）を出す。

- [ ] **Step 2: Capture idle, invalid input, success home**

空送信または空白のみで NAME-04。有効名で HOME-01。

- [ ] **Step 3: Write e2e-report.md**

実行環境、コマンド、各 PNG を添付する。`recording-ios-e2e-evidence` に従う。

- [ ] **Step 4: Commit**

```bash
git add docs/logs/20260814152942-r1-step1-owner-display-name/screenshots \
  docs/logs/20260814152942-r1-step1-owner-display-name/e2e-report.md
git commit -m "docs: record Owner display name iOS evidence"
```
