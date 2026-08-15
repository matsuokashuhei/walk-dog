# R1 Step 2 Dog List, Register, and Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 認証済み Owner が Dogs List から Dog を登録・開き、API が `GET` / `POST /v1/dogs` と `GET /v1/dogs/:dogId` で Dog と Daily 30分 `currentGoal` を返す。

**Architecture:** `dogs` module が BearerAuth 付き route を `/v1/dogs` に載せる。use case は既存 `OwnerRepository.resolveByCognitoSubject` で Owner を解決し、`DogRepository` が `dogs` と `goal_revisions` を同一 transaction で扱う。モバイルは `lib/dog-api.ts` 経由で一覧・登録・プロフィールを出す。

**Tech Stack:** Hono、`@hono/zod-openapi`、Zod 4、Drizzle、Expo Router、Node.js test runner

**Spec:** `docs/logs/20260814213159-r1-step2-dog/design.md`、`dog-api-spec.html`、`dog-spec-mockups.html`

## Global Constraints

- 公開契約は `dog-api-spec.html` と `dog-spec-mockups.html` に従う。
- `GET /v1/dogs` 成功は 200 `{ requestId, dogs }`。0件は `dogs: []`。
- `POST /v1/dogs` 成功は 201。body は `{ name, gender, birthday? }`。応答は Dog + `currentGoal`（`period: "daily"`, `minutes: 30`, `effectiveTo: null`）。
- `GET /v1/dogs/:dogId` 成功は 200 で POST 201 と同じ Dog + `currentGoal`。別 Owner / 未知 id は 404 `NOT_FOUND`。
- `name` は `z.string().trim().nonempty().max(100)`。`gender` は `male` | `female` | `unknown`。`birthday` 省略時は `{ precision: "unknown" }`。
- 同一 Owner の Name 重複は 409、`code: "DOG_NAME_DUPLICATE"`、`message: "同じ名前のDogが既に存在します。"`、`retryable: false`。
- 認証ゲート失敗は 401 `UNAUTHENTICATED`、`message: "Authentication is required."`、`retryable: false`。
- 入力不正は 400 `INVALID_INPUT`、`message: "入力内容を確認してください。"`、`retryable: false`。
- use case は Hono / Zod / AWS SDK / Drizzle を import しない。
- collaborator は required 注入。Quiet no-op を production factory に埋めない。
- モバイル HTTP は `lib/dog-api.ts`。画面は `apiRequest` を直接呼ばない。
- コマンドは指定がなければ `apps/api` または `apps/mobile` から実行する。
- 各 Task は targeted test → 関連 gate → commit。

## File map

| File | Responsibility |
| --- | --- |
| `apps/api/src/infrastructure/database/schema/dog.ts` | `dogs` table、gender enum、`(owner_id, name)` unique |
| `apps/api/src/infrastructure/database/schema/goal-revision.ts` | `goal_revisions` table、period enum |
| `apps/api/src/modules/dogs/*` | types、repository interface、errors、contracts、use cases、routes |
| `apps/api/src/infrastructure/database/repositories/drizzle-dog-repository.ts` | Drizzle 実装 |
| `apps/api/src/index.ts` | `dogs` の生成と `/v1/dogs` mount |
| `apps/mobile/src/lib/dog-api.ts` | GET/POST dogs helpers |
| `apps/mobile/src/app/(app)/index.tsx` | Dogs List |
| `apps/mobile/src/app/(app)/dogs/new.tsx` | Register Dog |
| `apps/mobile/src/app/(app)/dogs/[dogId].tsx` | Profile Detail |

## Shared types (all tasks)

```ts
export type Birthday =
  | { precision: 'unknown' }
  | { precision: 'year'; year: number }
  | { precision: 'month'; year: number; month: number }
  | { precision: 'day'; year: number; month: number; day: number }

export type CurrentGoal = {
  goalRevisionId: string
  period: 'daily'
  minutes: number
  effectiveFrom: Date
  effectiveTo: Date | null
}

export type Dog = {
  dogId: string
  ownerId: string
  name: string
  gender: 'male' | 'female' | 'unknown'
  birthday: Birthday
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
  currentGoal: CurrentGoal
}

export type CreateDogInput = {
  name: string
  gender: Dog['gender']
  birthday: Birthday
}
```

## Task-to-design traceability

| Task | Design section | Deliverable | Acceptance condition |
| --- | --- | --- | --- |
| 1. Schema | HOW PostgreSQL | `dogs` / `goal_revisions` + migration | 列、FK、`(owner_id, name)` 一意 |
| 2. Repository | HOW `DogRepository` | transaction insert + list/get | Daily 30、重複 error、Owner 境界 |
| 3. Use cases + routes | HOW API flow | GET/POST `/` と GET `/{dogId}` | 200 / 201 / 400 / 401 / 404 / 409 |
| 4. Composition | HOW mount | `index.ts`、OpenAPI | `/openapi.json` に3 path |
| 5. Mobile | HOW モバイル | list / new / detail | Empty → 登録 → 一覧 → Detail |
| 6. iOS evidence | Verification | screenshots / e2e-report | Empty、登録、エラー、重複、一覧、Detail |

---

### Task 1: Dog and Goal Revision schema

**Files:**
- Create: `apps/api/src/infrastructure/database/schema/dog.ts`
- Create: `apps/api/src/infrastructure/database/schema/goal-revision.ts`
- Create: `apps/api/test/infrastructure/database/dog-schema.test.ts`
- Create: generated `apps/api/drizzle/0001_create_dogs_and_goal_revisions.sql`（generate 後）

**Interfaces:**
- Consumes: `owners.ownerId`
- Produces: `dogs`、`goalRevisions` tables と enum

- [ ] **Step 1: Write failing schema tests**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { dogs } from '../../../src/infrastructure/database/schema/dog.js'
import { goalRevisions } from '../../../src/infrastructure/database/schema/goal-revision.js'

test('dogs table has the expected columns', () => {
  const columns = Object.keys(dogs)
  for (const key of ['dogId', 'ownerId', 'name', 'gender', 'birthday', 'createdAt', 'updatedAt']) {
    assert.ok(columns.includes(key), key)
  }
})

test('goal_revisions table has the expected columns', () => {
  const columns = Object.keys(goalRevisions)
  for (const key of ['goalRevisionId', 'dogId', 'period', 'minutes', 'effectiveFrom', 'effectiveTo', 'createdAt']) {
    assert.ok(columns.includes(key), key)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --import tsx --test test/infrastructure/database/dog-schema.test.ts`

Expected: FAIL（schema 未定義）

- [ ] **Step 3: Define schema**

`dog.ts`: `pgEnum('dog_gender', ['male', 'female', 'unknown'])`。`dogs` は UUID PK（`$default` uuidv7）、`ownerId` は `owners.ownerId` 参照、`name` text not null、`gender` enum not null、`birthday` jsonb not null、timestamps は owners と同じ。`(ownerId, name)` に unique。

`goal-revision.ts`: `pgEnum('goal_period', ['daily', 'weekly'])`。`goal_revisions` は UUID PK、`dogId` は `dogs.dogId` 参照、`period` enum not null、`minutes` integer not null、`effectiveFrom` timestamptz not null、`effectiveTo` timestamptz nullable、`createdAt` not null。

公式: https://orm.drizzle.team/docs/sql-schema-declaration 、https://orm.drizzle.team/docs/column-types/pg 、https://orm.drizzle.team/docs/indexes-constraints

- [ ] **Step 4: Generate and review migration**

Run: `cd apps/api && npx drizzle-kit generate --name=create_dogs_and_goal_revisions`

Expected: `dogs`、`goal_revisions`、enum、unique、FK を含む SQL。`drizzle-kit push` は使わない。

- [ ] **Step 5: Run schema tests**

Run: `cd apps/api && node --import tsx --test test/infrastructure/database/dog-schema.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/infrastructure/database/schema \
  apps/api/test/infrastructure/database/dog-schema.test.ts \
  apps/api/drizzle
git commit -m "feat(api): add dogs and goal_revisions schema"
```

---

### Task 2: DogRepository

**Files:**
- Create: `apps/api/src/modules/dogs/types.ts`
- Create: `apps/api/src/modules/dogs/errors.ts`
- Create: `apps/api/src/modules/dogs/repository.ts`
- Create: `apps/api/src/modules/dogs/index.ts`（型と repository の export。routes は Task 3）
- Create: `apps/api/src/infrastructure/database/repositories/drizzle-dog-repository.ts`
- Test: `apps/api/test/infrastructure/database/drizzle-dog-repository.test.ts`

**Interfaces:**
- Consumes: schema tables、`Owner.ownerId`
- Produces:

```ts
export class DogNameDuplicateError extends Error {
  readonly code = 'DOG_NAME_DUPLICATE' as const
}

export interface DogRepository {
  listByOwner(ownerId: string): Promise<Dog[]>
  createWithDailyGoal(ownerId: string, input: CreateDogInput): Promise<Dog>
  getByOwnerAndId(ownerId: string, dogId: string): Promise<Dog | null>
}
```

`createWithDailyGoal` の Name 重複は `DogNameDuplicateError` を throw する。`getByOwnerAndId` は別 Owner または未知 id で `null`。

- [ ] **Step 1: Write failing repository tests**

owners の database fake と同じく `insert` / `select` / `transaction` を記録する fake を置く。最低限:

1. `createWithDailyGoal` が Dog と `currentGoal.period === 'daily'`、`minutes === 30`、`effectiveTo === null` を返す。
2. unique 違反（`code: '23505'`）で `DogNameDuplicateError`。
3. `listByOwner` が currentGoal 付き配列を返す。
4. `getByOwnerAndId` が一致時 Dog、不一致時 `null`。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --import tsx --test test/infrastructure/database/drizzle-dog-repository.test.ts`

Expected: FAIL（repository 未定義）

- [ ] **Step 3: Implement repository**

`createWithDailyGoal` は `database.transaction` で `dogs` insert のあと `goal_revisions` insert（`period: 'daily'`, `minutes: 30`, `effectiveFrom` は Dog の `createdAt`, `effectiveTo: null`）。Postgres `23505` を `DogNameDuplicateError` へ変換する。

`listByOwner` / `getByOwnerAndId` は `effectiveTo` が null の Revision を currentGoal として結合する。`avatarUrl` は常に `null`。

公式: https://orm.drizzle.team/docs/insert

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && node --import tsx --test test/infrastructure/database/drizzle-dog-repository.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/dogs apps/api/src/infrastructure/database/repositories/drizzle-dog-repository.ts \
  apps/api/test/infrastructure/database/drizzle-dog-repository.test.ts
git commit -m "feat(api): persist dogs with daily goal revisions"
```

---

### Task 3: Dog use cases and routes

**Files:**
- Create: `apps/api/src/modules/dogs/contracts.ts`
- Create: `apps/api/src/modules/dogs/dog-response.ts`
- Create: `apps/api/src/modules/dogs/use-cases/list-dogs.ts`
- Create: `apps/api/src/modules/dogs/use-cases/create-dog.ts`
- Create: `apps/api/src/modules/dogs/use-cases/get-dog.ts`
- Create: `apps/api/src/modules/dogs/routes/list-dogs.ts`
- Create: `apps/api/src/modules/dogs/routes/create-dog.ts`
- Create: `apps/api/src/modules/dogs/routes/get-dog.ts`
- Create: `apps/api/src/modules/dogs/routes/index.ts`
- Test: `apps/api/test/modules/dogs/use-cases/*.test.ts`
- Test: `apps/api/test/modules/dogs/routes/*.test.ts`
- Test: `apps/api/test/modules/dogs/fixtures.ts`（owners fixture と同じ child-app 形。mount path は `/v1/dogs`）

**Interfaces:**
- Consumes: `OwnerRepository.resolveByCognitoSubject`、`DogRepository`
- Produces:

```ts
export type ListDogs = (cognitoSubject: string) => Promise<Dog[]>
export type CreateDog = (input: {
  cognitoSubject: string
  name: string
  gender: Dog['gender']
  birthday: Birthday
}) => Promise<{ ok: true; dog: Dog } | { ok: false; error: 'duplicate_name' }>
export type GetDog = (input: {
  cognitoSubject: string
  dogId: string
}) => Promise<{ ok: true; dog: Dog } | { ok: false; error: 'not_found' }>
```

Zod:

```ts
export const birthdaySchema = z.discriminatedUnion('precision', [
  z.object({ precision: z.literal('unknown') }),
  z.object({ precision: z.literal('year'), year: z.number().int() }),
  z.object({ precision: z.literal('month'), year: z.number().int(), month: z.number().int().min(1).max(12) }),
  z.object({ precision: z.literal('day'), year: z.number().int(), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) }),
])

export const createDogRequestSchema = z.strictObject({
  name: z.string().trim().nonempty().max(100),
  gender: z.enum(['male', 'female', 'unknown']),
  birthday: birthdaySchema.optional(),
})
```

`currentGoal` response object: `goalRevisionId` string、`period` literal `daily`、`minutes` number、`effectiveFrom` string、`effectiveTo` string nullable。

Route paths: GET `/`、POST `/`、GET `/{dogId}`。tags `dogs`。security `[{ BearerAuth: [] }]`。POST 201 / 400 / 401 / 409 / 500。GET list 200 / 401 / 500。GET by id 200 / 401 / 404 / 500。

省略された `birthday` は handler で `{ precision: 'unknown' }` にする。

- [ ] **Step 1: Write failing use case tests**

`createDog` は Owner 解決 → `createWithDailyGoal`。`DogNameDuplicateError` は `{ ok: false, error: 'duplicate_name' }`。`getDog` の `null` は `{ ok: false, error: 'not_found' }`。`listDogs` は配列。

- [ ] **Step 2: Write failing route contract tests**

owners の `update-owner.test.ts` と同じ envelope 断言。最低限:

- GET `/v1/dogs` 200 空配列
- GET `/v1/dogs` 401（Authorization 欠如）
- POST 201 と `currentGoal.period === 'daily'`、`minutes === 30`、`effectiveTo === null`
- POST 400: `name` 欠如、空、空白のみ、101 文字、`gender` 欠如、余剰キー、不正 JSON
- POST 401
- POST 409 `DOG_NAME_DUPLICATE` とメッセージ「同じ名前のDogが既に存在します。」
- GET `/v1/dogs/:dogId` 200
- GET `/v1/dogs/:dogId` 404 `NOT_FOUND`（既存 app notFound と同じ message: `The requested resource was not found.`）
- GET `/v1/dogs/:dogId` 401

400/401/409/404 は `code` / `message` / `requestId` / `retryable` を assert する。

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/api && node --import tsx --test test/modules/dogs/**/*.test.ts`

Expected: FAIL

- [ ] **Step 4: Implement use cases and routes**

use case は Hono/Zod/Drizzle を import しない。route は `ctx.req.valid` と `toDogResponse(requestId, dog)`。duplicate は 409、not_found は 404。

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && node --import tsx --test test/modules/dogs/**/*.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/dogs apps/api/test/modules/dogs
git commit -m "feat(api): add dog list, create, and profile routes"
```

---

### Task 4: Compose dog routes and OpenAPI

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/modules/dogs/index.ts`（`registerDogRoutes` export）
- Modify: `apps/api/test/composition.test.ts`
- Modify: `apps/api/test/openapi.test.ts`
- Modify: OpenAPI app factory が dogs を mount する箇所

**Interfaces:**
- Consumes: `registerDogRoutes`、`DogRepository`、`OwnerRepository`、`AccessTokenVerifier`
- Produces: `{ path: '/v1/dogs', app: dogRoutes }`

- [ ] **Step 1: Extend failing OpenAPI assertions**

`expectedOperations` / `expectedPathMethods` に:

- `/v1/dogs`: get `['200', '401', '500']`、post `['201', '400', '401', '409', '500']`
- `/v1/dogs/{dogId}`: get `['200', '401', '404', '500']`

POST request schema: `required` に `name` と `gender`。`name.minLength === 1`、`name.maxLength === 100`、`name.nullable` は undefined。BearerAuth を3 operation に付ける。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --import tsx --test test/openapi.test.ts`

Expected: FAIL（path 未 mount）

- [ ] **Step 3: Wire composition**

`createDogRepository` factory を追加する。`createUseCases` は `listDogs` / `createDog` / `getDog` を OwnerRepository + DogRepository から作る。routes 配列へ `{ path: '/v1/dogs', app: dogRoutes }` を追加する。composition テストの call 順と mount 一覧を同じ変更で更新する。

- [ ] **Step 4: Run OpenAPI, composition, and check**

Run: `cd apps/api && node --import tsx --test test/openapi.test.ts test/composition.test.ts && npm run check`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/modules/dogs/index.ts \
  apps/api/test/composition.test.ts apps/api/test/openapi.test.ts
git commit -m "feat(api): mount dog routes on /v1/dogs"
```

---

### Task 5: Mobile list, register, and profile

**Files:**
- Create: `apps/mobile/src/lib/dog-api.ts`
- Modify: `apps/mobile/src/app/(app)/index.tsx`
- Create: `apps/mobile/src/app/(app)/dogs/new.tsx`
- Create: `apps/mobile/src/app/(app)/dogs/[dogId].tsx`
- Modify: `apps/mobile/src/app/(app)/_layout.tsx`

**Interfaces:**
- Consumes: `apiRequest`、`useAuth().session`
- Produces:

```ts
type CurrentGoalResponse = {
  goalRevisionId: string
  period: 'daily'
  minutes: number
  effectiveFrom: string
  effectiveTo: string | null
}

type DogResponse = {
  requestId: string
  dogId: string
  ownerId: string
  name: string
  gender: 'male' | 'female' | 'unknown'
  birthday: Birthday
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  currentGoal: CurrentGoalResponse
}

function listDogs(accessToken: string): Promise<{ requestId: string; dogs: Omit<DogResponse, 'requestId'>[] }>
function createDog(accessToken: string, body: { name: string; gender: DogResponse['gender']; birthday?: Birthday }): Promise<DogResponse>
function getDog(accessToken: string, dogId: string): Promise<DogResponse>
```

- [ ] **Step 1: Add dog-api helpers**

`listDogs` は `GET /v1/dogs`、`createDog` は `POST /v1/dogs`、`getDog` は `GET /v1/dogs/${dogId}`。画面は `apiRequest` を import しない。

- [ ] **Step 2: Replace authenticated home with Dogs List**

DOG-01 Empty / Loading / List / Error。`testID`: `dogs-list-root`、`dogs-list-add`、`dogs-list-empty-register`、`dogs-list-retry`、`dogs-list-settings`、行は `dogs-list-row-${dogId}`。Empty と ＋ は `/dogs/new`。行は `/dogs/${dogId}`。Settings は `/settings`。行は名前と `30 min daily goal`（`currentGoal.minutes` と `period`）。

- [ ] **Step 3: Add `/dogs/new`**

DOG-03。`testID`: `dog-new-root`、`dog-new-name`、`dog-new-gender-male` / `female` / `unknown`、`dog-new-submit`、`dog-new-back`、`dog-new-error`。Name と Gender が揃うまで送信しない。送信中は再操作しない。400 は「名前は1〜100文字で入力してください。」。409 は API `message`。その他は「登録に失敗しました。再試行してください。」。未保存の戻るは確認。成功後は `router.replace('/')`。

- [ ] **Step 4: Add `/dogs/[dogId]`**

DOG-02。`testID`: `dog-detail-root`、`dog-detail-retry`、`dog-detail-back`。名前、Gender、Birthday、`currentGoal`（Daily 30分）。404 は「見つかりません」と一覧へ戻る。静的 `new` が `[dogId]` より先にマッチする配置にする。

- [ ] **Step 5: Register screens in `(app)/_layout`**

表示名ゲートのあと `index`、`dogs/new`、`dogs/[dogId]`、`settings` を積む。

- [ ] **Step 6: Typecheck mobile**

Run: `cd apps/mobile && npx tsc --noEmit`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/lib/dog-api.ts \
  apps/mobile/src/app/(app)/index.tsx \
  apps/mobile/src/app/(app)/dogs \
  apps/mobile/src/app/(app)/_layout.tsx
git commit -m "feat(mobile): add dog list, register, and profile screens"
```

---

### Task 6: iOS E2E evidence

**Files:**
- Create: `docs/logs/20260814213159-r1-step2-dog/screenshots/ios-dogs-empty.png`
- Create: `docs/logs/20260814213159-r1-step2-dog/screenshots/ios-dog-new-invalid.png`
- Create: `docs/logs/20260814213159-r1-step2-dog/screenshots/ios-dogs-list.png`
- Create: `docs/logs/20260814213159-r1-step2-dog/screenshots/ios-dog-duplicate.png`
- Create: `docs/logs/20260814213159-r1-step2-dog/screenshots/ios-dog-detail.png`
- Create: `docs/logs/20260814213159-r1-step2-dog/e2e-report.md`

**Interfaces:**
- Consumes: local API（migration 適用済み）、Cognito OTP、iPhone simulator development client
- Produces: Empty、登録入力エラー、重複、成功後一覧、Detail の PNG とレポート

- [ ] **Step 1: Confirm AWS SSO before Verify**

Run: `aws sts get-caller-identity --profile walk-dog`

失敗したら `aws sso login --profile walk-dog` を出して停止する。Verify へ進めるのは成功後だけ。

- [ ] **Step 2: Apply migration and boot API + Metro**

`apps/api` で `npm run migrate` のあと `npm run dev`。モバイルは既存 development client。

- [ ] **Step 3: Capture required states**

Sign In → 表示名済みホームが Empty（DOG-01）。登録で空 Name なら invalid。`Mugi` + gender で 201 のあと List。同じ Name でもう一度登録して duplicate。行タップで Detail。

- [ ] **Step 4: Write e2e-report.md**

`recording-ios-e2e-evidence` に従い、コマンド、各 PNG、`POST /v1/dogs` 201 と `currentGoal` を記載する。

- [ ] **Step 5: Commit**

```bash
git add docs/logs/20260814213159-r1-step2-dog/screenshots \
  docs/logs/20260814213159-r1-step2-dog/e2e-report.md
git commit -m "docs: record Dog list and register iOS evidence"
```

---

## Self-review

1. **Spec coverage:** List GET、Register POST + currentGoal、Detail GET、Empty/Loading/Error、discard confirm、409 duplicate、404、401/400 envelope、schema unique、iOS 証跡 → Tasks 1–6。
2. **Placeholders:** なし。
3. **Type consistency:** `Dog` / `Birthday` / `CurrentGoal` / `DogRepository` / `CreateDog` / `GetDog` を全 Task で同じ名前。
