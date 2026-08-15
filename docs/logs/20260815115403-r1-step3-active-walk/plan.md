# R1 Step 3 Active Walk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 認証済み Owner が Walk タブで Dog を選んで散歩を開始し、API が Active Walk の照会・開始・Finish を返し、許可時は Apple MapKit に現在地を出す。

**Architecture:** `walks` module が BearerAuth 付き route を `/v1/walks` に載せる。use case は `OwnerRepository.resolveByCognitoSubject` で Owner を解決し、`WalkRepository` が `walks` / `walk_participants` / `walk_command_keys` を同一 transaction で扱う。`failIfPresent` は同じ repository が提供し、Sign Out がそれを呼ぶ。モバイルは NativeTabs（Dogs / Walk）と `lib/walk-api.ts` 経由で画面状態を API と同期する。

**Tech Stack:** Hono、`@hono/zod-openapi`、Zod 4、Drizzle、Expo Router NativeTabs、`expo-location`、`expo-maps` `AppleMaps.View`、Node.js test runner

**Spec:** `docs/logs/20260815115403-r1-step3-active-walk/design.md`、`walk-api-spec.html`、`walk-spec-mockups.html`

## Global Constraints

- 公開契約は `walk-api-spec.html` と `walk-spec-mockups.html` に従う。
- `GET /v1/walks/active` 成功は 200 recording Walk、または 204 空 body。
- `POST /v1/walks` 成功は 201。Header `Idempotency-Key`（1–256 文字）必須。body は `{ participantDogIds: UUID[] }`（1件以上、重複なし、すべて同一 Owner）。応答 `state` は `recording`。`completedAt` は `null`。`participants` は request 順。
- `POST /v1/walks/:walkId/finish` 成功は 200。Header は Finish 用 `Idempotency-Key`（開始とは別名前空間）。body は `{}`。`durationSeconds` は `startedAt` → `completedAt`。`distanceMeters` は `0`。`paceSecondsPerMeter` は `null`。
- DB の `state` は `recording` | `completed` | `failed`。`starting` は画面状態だけ。
- Owner あたり `recording` は 1 件。衝突は 409 `ACTIVE_WALK_EXISTS`、message「すでに記録中の散歩があります。」、`retryable: false`。
- 同一 Key + 同一 body hash は元の Walk を返す。同一 Key + 異なる hash は 409 `IDEMPOTENCY_CONFLICT`、message「同じ要求を完了できません。最初からやり直してください。」、`retryable: false`。
- 別 Owner / 未知の `dogId` / `walkId` / 非 UUID `walkId` は 404 `NOT_FOUND`、message「The requested resource was not found.」、`retryable: false`。
- `recording` ではない Finish は 409 `WALK_NOT_RECORDING`、message「この散歩は終了できません。」、`retryable: false`。
- 入力不正（Key 欠如、空配列、重複 dogId、余剰キー、不正 JSON）は 400 `INVALID_INPUT`、message「入力内容を確認してください。」、`retryable: false`。
- 認証ゲート失敗は 401 `UNAUTHENTICATED`、message「Authentication is required.」、`retryable: false`。
- 500 は既存 `app.ts` と同じ `INTERNAL_ERROR`、`retryable: false`。
- error envelope は `{ code, message, requestId, retryable }`。
- use case は Hono / Zod / AWS SDK / Drizzle を import しない。
- collaborator は required 注入。Quiet no-op を production factory に埋めない。`createAbsentActiveWalkCommands` はこの縦切りで削除する。
- モバイル HTTP は `lib/walk-api.ts`。画面は `apiRequest` を直接呼ばない。
- 位置情報は foreground のあと background を要求する。両方許可されたときだけ地図と Start 有効化（Dog 選択も揃っていること）。
- 現在地は端末 GPS。TrackPoint API には送らない。経路・Event・Walk Detail・Owner タブはこの計画に含めない。
- SQL migration は 1 ファイル 1 `CREATE TABLE`。`drizzle-kit push` は使わない。
- コマンドは指定がなければ `apps/api` または `apps/mobile` から実行する。
- 各 Task は targeted test → 関連 gate → commit。

## File map

| File | Responsibility |
| --- | --- |
| `apps/api/src/infrastructure/database/schema/walk.ts` | `walks` table、`walk_state` enum、Owner あたり recording unique |
| `apps/api/src/infrastructure/database/schema/walk-participant.ts` | `walk_participants` table、`(walk_id, dog_id)` unique、request 順 |
| `apps/api/src/infrastructure/database/schema/walk-command-key.ts` | `walk_command_keys` table、`(owner_id, namespace, key)` unique |
| `apps/api/drizzle/0003_create_walks.sql` | `walks` の CREATE TABLE |
| `apps/api/drizzle/0004_create_walk_participants.sql` | `walk_participants` の CREATE TABLE |
| `apps/api/drizzle/0005_create_walk_command_keys.sql` | `walk_command_keys` の CREATE TABLE |
| `apps/api/src/modules/walks/*` | types、repository、errors、contracts、use cases、routes |
| `apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts` | Drizzle 実装。`failIfPresent` を含む |
| `apps/api/src/index.ts` | `walks` の生成、`/v1/walks` mount、`createAbsentActiveWalkCommands` を置換 |
| `apps/mobile/src/lib/api.ts` | `headers` で `Idempotency-Key` を送る |
| `apps/mobile/src/lib/walk-api.ts` | GET active / POST start / POST finish |
| `apps/mobile/src/app/(app)/(tabs)/_layout.tsx` | NativeTabs。Dogs と Walk |
| `apps/mobile/src/app/(app)/(tabs)/index.tsx` | 現行 Dogs List を移す |
| `apps/mobile/src/app/(app)/(tabs)/walk.tsx` | Walk 画面 |
| `apps/mobile/src/lib/active-walk.ts` | 削除。Settings は `getActiveWalk` を使う |
| `apps/mobile/app.json` | `expo-location` と `expo-maps` の plugin |

## Shared types (all tasks)

```ts
export type WalkState = 'recording' | 'completed' | 'failed'

export type WalkParticipant = {
  walkParticipantId: string
  dogId: string
  name: string
}

export type RecordingWalk = {
  walkId: string
  ownerId: string
  state: 'recording'
  startedAt: Date
  completedAt: null
  participants: WalkParticipant[]
}

export type CompletedWalk = {
  walkId: string
  ownerId: string
  state: 'completed'
  startedAt: Date
  completedAt: Date
  durationSeconds: number
  distanceMeters: 0
  paceSecondsPerMeter: null
  participants: WalkParticipant[]
}

export type Walk = RecordingWalk | CompletedWalk

export type CommandNamespace = 'start' | 'finish'

export type StartWalkInput = {
  ownerId: string
  participantDogIds: string[]
  idempotencyKey: string
  bodyHash: string
}

export type FinishWalkInput = {
  ownerId: string
  walkId: string
  idempotencyKey: string
  bodyHash: string
}
```

`bodyHash` は `createHash('sha256').update(JSON.stringify(body)).digest('hex')`。開始は `{ participantDogIds }` の JSON（配列順を保持）。Finish は `'{}'`。

`durationSeconds` は `Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)`。

Idempotency 行は削除しない。同一 `(ownerId, namespace, key)` は hash が同じなら元の Walk を返し、違えば衝突する。24h はクライアントが Key を持ち続ける契約。

`rememberCommand` は `start` / `finish` の同一 transaction 内で行う。repository の公開メソッドには出さない。

## Task-to-design traceability

| Design 受け入れ | Task |
| --- | --- |
| schema / unique recording / command keys | 1, 2 |
| GET active 200 / 204 | 3, 4 |
| POST start 201 / 400 / 401 / 404 / 409 | 3, 4 |
| POST finish 200 / 距離 0 / 409 WALK_NOT_RECORDING | 3, 4 |
| Sign Out `failIfPresent` | 2, 4, 5 |
| NativeTabs、Walk 画面 5 状態、地図と現在地 | 5 |
| iOS 証跡 | 6 |

---

### Task 1: Walk schema and migrations

**Files:**
- Create: `apps/api/src/infrastructure/database/schema/walk.ts`
- Create: `apps/api/src/infrastructure/database/schema/walk-participant.ts`
- Create: `apps/api/src/infrastructure/database/schema/walk-command-key.ts`
- Create: `apps/api/drizzle/0003_create_walks.sql`（generate 後に split）
- Create: `apps/api/drizzle/0004_create_walk_participants.sql`
- Create: `apps/api/drizzle/0005_create_walk_command_keys.sql`
- Modify: `apps/api/drizzle/meta/_journal.json` と snapshot（generate / split の結果）

**Interfaces:**
- Consumes: `owners.ownerId`、`dogs.dogId`、既存 drizzle-kit config（`schema: './src/infrastructure/database/schema/*.ts'`）
- Produces: `walks` / `walkParticipants` / `walkCommandKeys` table exports

実装前に https://orm.drizzle.team/docs/sql-schema-declaration と https://orm.drizzle.team/docs/indexes-constraints と https://orm.drizzle.team/docs/drizzle-kit-generate を読む。セッション log に URL を残す。

- [ ] **Step 1: Write schema files**

`walk.ts`:

```ts
import { sql } from 'drizzle-orm'
import { pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { owners } from './owner.js'

export const walkStateEnum = pgEnum('walk_state', ['recording', 'completed', 'failed'])

export const walks = pgTable('walks', {
  walkId: uuid('walk_id').primaryKey().$default(() => uuidv7()),
  ownerId: uuid('owner_id').notNull().references(() => owners.ownerId),
  state: walkStateEnum('state').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('walks_owner_id_recording_unique').on(table.ownerId).where(sql`${table.state} = 'recording'`),
])
```

`walk-participant.ts`:

```ts
import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { dogs } from './dog.js'
import { walks } from './walk.js'

export const walkParticipants = pgTable('walk_participants', {
  walkParticipantId: uuid('walk_participant_id').primaryKey().$default(() => uuidv7()),
  walkId: uuid('walk_id').notNull().references(() => walks.walkId),
  dogId: uuid('dog_id').notNull().references(() => dogs.dogId),
  name: text('name').notNull(),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('walk_participants_walk_id_dog_id_unique').on(table.walkId, table.dogId),
])
```

`walk-command-key.ts`:

```ts
import { pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { owners } from './owner.js'
import { walks } from './walk.js'

export const walkCommandNamespaceEnum = pgEnum('walk_command_namespace', ['start', 'finish'])

export const walkCommandKeys = pgTable('walk_command_keys', {
  walkCommandKeyId: uuid('walk_command_key_id').primaryKey().$default(() => uuidv7()),
  ownerId: uuid('owner_id').notNull().references(() => owners.ownerId),
  namespace: walkCommandNamespaceEnum('namespace').notNull(),
  key: text('key').notNull(),
  bodyHash: text('body_hash').notNull(),
  walkId: uuid('walk_id').notNull().references(() => walks.walkId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('walk_command_keys_owner_id_namespace_key_unique').on(table.ownerId, table.namespace, table.key),
])
```

`name` は開始時点の Dog 名スナップショット。`position` は request の 0 始まり順。

- [ ] **Step 2: Generate then split SQL**

Run: `cd apps/api && npx drizzle-kit generate --name=create_walks`

Expected: 生成 SQL に `walks` / `walk_participants` / `walk_command_keys` が含まれる。

1 ファイルに `CREATE TABLE` が複数ある場合は `0003_create_walks.sql` / `0004_create_walk_participants.sql` / `0005_create_walk_command_keys.sql` に分け、`_journal.json` と snapshot をファイルごとに揃える。各 SQL は対象テーブルの enum、index、FK を同じファイルに置く。`CREATE TABLE` はファイルあたり 1 つ。

- [ ] **Step 3: Typecheck schema**

Run: `cd apps/api && npx tsc --noEmit`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/infrastructure/database/schema/walk.ts \
  apps/api/src/infrastructure/database/schema/walk-participant.ts \
  apps/api/src/infrastructure/database/schema/walk-command-key.ts \
  apps/api/drizzle
git commit -m "feat(api): add walks, participants, and command-key schema"
```

---

### Task 2: WalkRepository

**Files:**
- Create: `apps/api/src/modules/walks/types.ts`（Task 1 の Shared types）
- Create: `apps/api/src/modules/walks/errors.ts`
- Create: `apps/api/src/modules/walks/repository.ts`
- Create: `apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts`
- Modify: `apps/api/src/modules/walks/active-walk-commands.ts`（`WalkRepository` が `failIfPresent` を満たすことを型で固定）
- Test: `apps/api/test/infrastructure/database/drizzle-walk-repository.test.ts`
- Delete: `apps/api/src/infrastructure/walks/absent-active-walk-commands.ts`（Task 4 で factory 置換と同時でもよい。この Task では repository が `ActiveWalkCommands` を満たすことまで）

**Interfaces:**
- Consumes: `DbInstance`、`walks` / `walkParticipants` / `walkCommandKeys` / `dogs`
- Produces:

```ts
export class ActiveWalkExistsError extends Error {
  readonly code = 'ACTIVE_WALK_EXISTS' as const
}
export class IdempotencyConflictError extends Error {
  readonly code = 'IDEMPOTENCY_CONFLICT' as const
}
export class WalkNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const
}
export class WalkNotRecordingError extends Error {
  readonly code = 'WALK_NOT_RECORDING' as const
}

export interface WalkRepository {
  getActiveByOwner(ownerId: string): Promise<RecordingWalk | null>
  start(input: StartWalkInput): Promise<RecordingWalk>
  finish(input: FinishWalkInput): Promise<CompletedWalk>
  failIfPresent(input: { ownerId: string }): Promise<void>
}
```

`WalkRepository` は `ActiveWalkCommands` を構造的に満たす（`failIfPresent` の signature は既存のまま）。

- [ ] **Step 1: Write failing repository tests**

`drizzle-dog-repository.test.ts` と同じ database fake（`transaction` / `insert` / `select` / `update` / `returning`）。最低限:

1. `getActiveByOwner` は `state = 'recording'` の Walk と `position` 順の participants を返す。無ければ `null`。
2. `start` は transaction で `walks` insert（`state: 'recording'`, `startedAt` 設定, `completedAt: null`）→ participants を request 順で insert（`dogs` から `name` を読む）→ `walk_command_keys` insert（`namespace: 'start'`）。
3. 同一 Key + 同一 `bodyHash` は既存 Walk を返す（insert しない）。
4. 同一 Key + 異なる `bodyHash` は `IdempotencyConflictError`。
5. recording unique の `23505` は `ActiveWalkExistsError`。
6. `participantDogIds` のうち Owner のものではない / 存在しない dog は `WalkNotFoundError`。
7. `finish` は対象 Walk を `completed` にし、`completedAt` を書き、`durationSeconds` を計算し、`distanceMeters: 0`、`paceSecondsPerMeter: null`、Finish command key を残す。
8. 同一 Finish Key + 同一 hash は既存 Completed Walk を返す。
9. 同一 Finish Key + 異なる hash は `IdempotencyConflictError`。
10. 別 Owner / 未知 walkId は `WalkNotFoundError`。
11. `state !== 'recording'` の Finish は `WalkNotRecordingError`。
12. `failIfPresent` は recording を `failed` にする。recording が無ければ insert/update 0 件で resolve する。

Dog 名の読み取りは `select` from `dogs` where `owner_id` + `dog_id`。見つからない id があれば `WalkNotFoundError`。見つかった行の `name` を participant にコピーする。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --import tsx --test test/infrastructure/database/drizzle-walk-repository.test.ts`

Expected: FAIL（repository 未定義）

- [ ] **Step 3: Implement repository**

`start` / `finish` は `database.transaction`。command key の照合は transaction の先頭。hash 一致なら既存 Walk を participants 付きで返す。

`23505` の変換は `drizzle-dog-repository.ts` の `isUniqueViolation` と同じ判定。constraint 名で `walks_owner_id_recording_unique` なら `ActiveWalkExistsError`、command key unique なら `IdempotencyConflictError`（通常は hash 照合が先に走る）。

公式: https://orm.drizzle.team/docs/insert https://orm.drizzle.team/docs/transactions

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && node --import tsx --test test/infrastructure/database/drizzle-walk-repository.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/walks apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts \
  apps/api/test/infrastructure/database/drizzle-walk-repository.test.ts
git commit -m "feat(api): persist active walks with start and finish idempotency"
```

---

### Task 3: Walk use cases and routes

**Files:**
- Create: `apps/api/src/modules/walks/contracts.ts`
- Create: `apps/api/src/modules/walks/walk-response.ts`
- Create: `apps/api/src/modules/walks/use-cases/get-active-walk.ts`
- Create: `apps/api/src/modules/walks/use-cases/start-walk.ts`
- Create: `apps/api/src/modules/walks/use-cases/finish-walk.ts`
- Create: `apps/api/src/modules/walks/routes/get-active-walk.ts`
- Create: `apps/api/src/modules/walks/routes/start-walk.ts`
- Create: `apps/api/src/modules/walks/routes/finish-walk.ts`
- Create: `apps/api/src/modules/walks/routes/index.ts`
- Modify: `apps/api/src/modules/walks/index.ts`（`registerWalkRoutes` export）
- Test: `apps/api/test/modules/walks/use-cases/*.test.ts`
- Test: `apps/api/test/modules/walks/routes/*.test.ts`
- Test: `apps/api/test/modules/walks/fixtures.ts`（dogs fixture と同じ child-app。mount path は `/v1/walks`）

**Interfaces:**
- Consumes: `OwnerRepository.resolveByCognitoSubject`、`WalkRepository`
- Produces:

```ts
export type GetActiveWalk = (cognitoSubject: string) => Promise<RecordingWalk | null>

export type StartWalk = (input: {
  cognitoSubject: string
  participantDogIds: string[]
  idempotencyKey: string
}) => Promise<
  | { ok: true; walk: RecordingWalk }
  | { ok: false; error: 'not_found' | 'active_walk_exists' | 'idempotency_conflict' }
>

export type FinishWalk = (input: {
  cognitoSubject: string
  walkId: string
  idempotencyKey: string
}) => Promise<
  | { ok: true; walk: CompletedWalk }
  | { ok: false; error: 'not_found' | 'walk_not_recording' | 'idempotency_conflict' }
>
```

Zod:

```ts
export const startWalkRequestSchema = z.strictObject({
  participantDogIds: z.array(z.uuid()).min(1).refine(
    (ids) => new Set(ids).size === ids.length,
    { message: 'duplicate' },
  ),
})

export const finishWalkRequestSchema = z.strictObject({})

export const finishWalkParamSchema = z.object({
  walkId: z.uuid(),
})

export const idempotencyKeyHeaderSchema = z.object({
  'idempotency-key': z.string().min(1).max(256),
})
```

Hono の header 名は lowercase。クライアントは `Idempotency-Key` を送る。欠如・空・257 文字は 400。

Route paths: GET `/active`、POST `/`、POST `/{walkId}/finish`。tags `walks`。security `[{ BearerAuth: [] }]`。

GET 200 / 204 / 401 / 500。POST start 201 / 400 / 401 / 404 / 409 / 500。POST finish 200 / 400 / 401 / 404 / 409 / 500。

204 は body なし（`ctx.body(null, 204)`）。

Recording JSON: `requestId, walkId, ownerId, state, startedAt, completedAt, participants[{ walkParticipantId, dogId, name }]`。Completed はそれに `durationSeconds, distanceMeters, paceSecondsPerMeter` を足す。Date は ISO string。

- [ ] **Step 1: Write failing use case tests**

`getActiveWalk` は Owner 解決 → `getActiveByOwner`。`startWalk` は Owner 解決 → `bodyHash` 計算 → `start`。`ActiveWalkExistsError` → `active_walk_exists`。`WalkNotFoundError` → `not_found`。`IdempotencyConflictError` → `idempotency_conflict`。`finishWalk` も同様に `walk_not_recording` を返す。

- [ ] **Step 2: Write failing route contract tests**

owners / dogs と同じ envelope 断言。最低限:

- GET `/v1/walks/active` 200 recording
- GET `/v1/walks/active` 204（body 空）
- GET `/v1/walks/active` 401
- POST `/v1/walks` 201。`state === 'recording'`、`completedAt === null`、participants が request 順
- POST 同一 `Idempotency-Key` + 同一 body → 201 で同じ `walkId`
- POST 400: body 欠如、`participantDogIds` 空、重複 UUID、非 UUID、余剰キー、不正 JSON、`Idempotency-Key` 欠如、空 Key、257 文字
- POST 401
- POST 404 `NOT_FOUND`
- POST 409 `ACTIVE_WALK_EXISTS` と「すでに記録中の散歩があります。」
- POST 409 `IDEMPOTENCY_CONFLICT` と「同じ要求を完了できません。最初からやり直してください。」
- POST `/v1/walks/:walkId/finish` 200。`durationSeconds` は startedAt/completedAt 差、`distanceMeters === 0`、`paceSecondsPerMeter === null`
- Finish 400: 余剰キー、Key 欠如
- Finish 404（未知 / 別 Owner / 非 UUID walkId）
- Finish 409 `WALK_NOT_RECORDING` と「この散歩は終了できません。」
- Finish 同一 Key 再送は 200 で同じ completed Walk

400/401/404/409 は `code` / `message` / `requestId` / `retryable` を assert する。

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/api && node --import tsx --test test/modules/walks/**/*.test.ts`

Expected: FAIL

- [ ] **Step 4: Implement use cases and routes**

use case は Hono/Zod/Drizzle を import しない。hash は `node:crypto` で use case が計算する。route は `ctx.req.valid('json' | 'header' | 'param')` と `toRecordingWalkResponse` / `toCompletedWalkResponse`。

`registerWalkRoutes` は dogs と同じ child OpenAPIHono + `createAuthenticationMiddleware`。

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && node --import tsx --test test/modules/walks/**/*.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/walks apps/api/test/modules/walks
git commit -m "feat(api): add active walk get, start, and finish routes"
```

---

### Task 4: Compose walk routes and replace absent ActiveWalkCommands

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/modules/walks/index.ts`
- Modify: `apps/api/test/composition.test.ts`
- Modify: `apps/api/test/openapi.test.ts`
- Delete: `apps/api/src/infrastructure/walks/absent-active-walk-commands.ts`
- Delete: `apps/api/test/infrastructure/walks/absent-active-walk-commands.test.ts`

**Interfaces:**
- Consumes: `registerWalkRoutes`、`WalkRepository`、`OwnerRepository`、`AccessTokenVerifier`
- Produces: `{ path: '/v1/walks', app: walkRoutes }`

`ApplicationFactories` の変更:

```ts
createWalkRepository: (db: DbInstance) => WalkRepository
createActiveWalkCommands: (walks: WalkRepository) => ActiveWalkCommands
```

default:

```ts
createWalkRepository(database) {
  return createDrizzleWalkRepository(database)
},
createActiveWalkCommands(walks) {
  return walks
},
```

`createApplication` は `const walkRepository = factories.createWalkRepository(database)` のあと `factories.createActiveWalkCommands(walkRepository)`。`createUseCases` は `getActiveWalk` / `startWalk` / `finishWalk` を OwnerRepository + WalkRepository から作る。

- [ ] **Step 1: Extend failing OpenAPI assertions**

`expectedOperations` / `expectedPathMethods` に:

- `/v1/walks/active`: get `['200', '204', '401', '500']`
- `/v1/walks`: post `['201', '400', '401', '404', '409', '500']`
- `/v1/walks/{walkId}/finish`: post `['200', '400', '401', '404', '409', '500']`

POST `/v1/walks` request schema: `required` に `participantDogIds`。`participantDogIds.minItems === 1`。Finish body は `additionalProperties` を拒否する strict object。3 operation すべてに BearerAuth。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --import tsx --test test/openapi.test.ts`

Expected: FAIL（path 未 mount）

- [ ] **Step 3: Wire composition**

routes 配列へ `{ path: '/v1/walks', app: walkRoutes }` を追加する。composition テストの call 順を次にする:

`config` → `logger` → `database` → `cognito-client` → `auth-provider` → `owner-repository` → `dog-repository` → `walk-repository` → `active-walk-commands` → `access-token-verifier` → `use-cases` → `auth-routes` → `owner-routes` → `dog-routes` → `walk-routes` → `health-routes` → `app`

`createActiveWalkCommands` は `WalkRepository` を受け取り、返した値が `signOut` に渡ることを assert する。

- [ ] **Step 4: Run OpenAPI, composition, walks tests, and check**

Run: `cd apps/api && node --import tsx --test test/openapi.test.ts test/composition.test.ts test/modules/walks/**/*.test.ts test/infrastructure/database/drizzle-walk-repository.test.ts && npm run check`

Expected: PASS。absent ActiveWalkCommands のテストはファイル削除後に走らない。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/modules/walks \
  apps/api/src/infrastructure/walks apps/api/test
git commit -m "feat(api): mount walk routes and fail active walks on sign-out"
```

---

### Task 5: Mobile tabs, Walk screen, location, and Sign Out

**Files:**
- Create: `apps/mobile/src/lib/walk-api.ts`
- Modify: `apps/mobile/src/lib/api.ts`（`ApiRequestOptions.headers?: Record<string, string>`）
- Modify: `apps/mobile/src/app/(app)/_layout.tsx`（`index` を `(tabs)` に置換）
- Create: `apps/mobile/src/app/(app)/(tabs)/_layout.tsx`
- Create: `apps/mobile/src/app/(app)/(tabs)/index.tsx`（現行 `(app)/index.tsx` を移動）
- Create: `apps/mobile/src/app/(app)/(tabs)/walk.tsx`
- Delete: `apps/mobile/src/app/(app)/index.tsx`
- Delete: `apps/mobile/src/lib/active-walk.ts`
- Modify: `apps/mobile/src/app/(app)/settings.tsx`
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/package.json`（`npx expo install expo-location expo-maps`）

**Interfaces:**
- Consumes: `apiRequest`、`useAuth().session`、`listDogs`、`expo-location`、`expo-maps`
- Produces:

```ts
type WalkParticipantResponse = {
  walkParticipantId: string
  dogId: string
  name: string
}

type RecordingWalkResponse = {
  requestId: string
  walkId: string
  ownerId: string
  state: 'recording'
  startedAt: string
  completedAt: null
  participants: WalkParticipantResponse[]
}

type CompletedWalkResponse = {
  requestId: string
  walkId: string
  ownerId: string
  state: 'completed'
  startedAt: string
  completedAt: string
  durationSeconds: number
  distanceMeters: 0
  paceSecondsPerMeter: null
  participants: WalkParticipantResponse[]
}

function getActiveWalk(accessToken: string): Promise<RecordingWalkResponse | null>
function startWalk(
  accessToken: string,
  input: { participantDogIds: string[]; idempotencyKey: string },
): Promise<RecordingWalkResponse>
function finishWalk(
  accessToken: string,
  input: { walkId: string; idempotencyKey: string },
): Promise<CompletedWalkResponse>
```

`getActiveWalk` は 204 のとき `null`（既存 `apiRequest` の 204 → `undefined` を `null` に揃える）。

`apiRequest` は `options.headers` を既存 Authorization / Content-Type にマージする。`startWalk` / `finishWalk` は `{ 'Idempotency-Key': idempotencyKey }` を渡す。

- [ ] **Step 1: Install native modules and plugins**

Run: `cd apps/mobile && npx expo install expo-location expo-maps`

`app.json` の `ios.infoPlist` に `NSLocationWhenInUseUsageDescription` と `NSLocationAlwaysAndWhenInUseUsageDescription`（文言: 「散歩の記録と地図の現在地表示に使います。」）と `UIBackgroundModes: ["location"]` を足す。`plugins` に `expo-location`（foreground → background を plugin で有効化）と `expo-maps` を足す。公式: https://docs.expo.dev/versions/v57.0.0/sdk/location/ https://docs.expo.dev/versions/v57.0.0/sdk/maps/

- [ ] **Step 2: Add walk-api helpers**

`GET /v1/walks/active`、`POST /v1/walks`、`POST /v1/walks/${walkId}/finish`。画面は `apiRequest` を import しない。

- [ ] **Step 3: Add NativeTabs**

`(app)/_layout.tsx` の表示名ゲート後:

```tsx
<Stack.Protected guard={!needsDisplayName}>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="dogs/new" />
  <Stack.Screen name="dogs/[dogId]" />
</Stack.Protected>
```

`(tabs)/_layout.tsx` は `expo-router/unstable-native-tabs` の SDK 57 構文。Trigger `index` Label `Dogs`、Trigger `walk` Label `Walk`。Icon は SF Symbols（Dogs: `dog.fill`、Walk: `figure.walk`）。インストール済み `expo-router` の export（`NativeTabs.Trigger.Icon` または `Icon` / `Label`）に合わせる。

現行 `(app)/index.tsx` を `(tabs)/index.tsx` へ移す。Dogs List の `testID` と遷移先（`/dogs/new`、`/dogs/${dogId}`、`/settings`）は変えない。

- [ ] **Step 4: Implement Walk screen states**

1 ファイル `(tabs)/walk.tsx`。状態:

| 状態 | 表示 | testID |
| --- | --- | --- |
| Loading | 「読み込み中…」Empty を出さない | `walk-root` `walk-loading` |
| Load error | 「読み込めませんでした。再試行してください。」再試行 | `walk-load-error` `walk-retry` |
| Ready empty dogs | 「散歩に連れて行く Dog を登録してください。」開始無効、Dog を登録 | `walk-empty-register` `walk-start` disabled |
| Ready no selection | 「Dog を1頭以上選んでください。」 | `walk-condition` `walk-dog-row-${dogId}` |
| Ready location | 「位置情報（使用中および常に）を許可してください。」位置情報を許可 | `walk-allow-location` |
| Ready startable | 「開始する」有効 | `walk-start` |
| Ready start failed | 「開始に失敗しました。再試行してください。」同じ Key で再 POST | `walk-start-error` |
| Starting | 「開始しています…」選択 Dog 名。操作しない | `walk-starting` |
| Recording | 「記録中」経過（`startedAt` から）、participants、終了する | `walk-elapsed` `walk-finish` |
| Finish failed | 「終了に失敗しました。再試行してください。」同じ Finish Key | `walk-finish-error` |
| Completed | 「散歩が完了しました」時間、`0 m`、Ready へ戻る | `walk-completed` `walk-back-ready` |
| Failed | 「記録に失敗しました」「この散歩は破棄されました。」Ready へ戻る | `walk-failed` `walk-back-ready` |

開いたとき `getActiveWalk` と `listDogs` を並行取得。200 recording → Recording。204 → Ready。地図は foreground **かつ** background が granted のときだけ。`AppleMaps.View` を背景にし `properties.isMyLocationEnabled: true`。カメラは `getCurrentPositionAsync` の座標を `cameraPosition` に渡す。未許可は地図を mount しない。

許可要求: `requestForegroundPermissionsAsync` のあと `requestBackgroundPermissionsAsync`。

Start は条件が揃うまで押しても送らない。押した時点で `crypto.randomUUID()` を start Key として state に保持し、Retry は同じ Key と同じ `participantDogIds`。Finish も別 Key を同様に保持する。

Recording 中に許可が取り消された、または再取得の GET active が 204 なら Failed。Completed の「Ready へ戻る」後の GET active は 204。

- [ ] **Step 5: Wire Settings Sign Out**

`hasActiveWalk()` を削除する。Sign Out 押下時に `getActiveWalk(session.accessToken)`。200 なら既存 Alert「Active Walk を破棄しますか？」→ 承諾後 `signOut`。204 なら確認なしで `signOut`。サーバの `failIfPresent` は既存 `POST /v1/auth/sign-out` が行う。

- [ ] **Step 6: Typecheck mobile**

Run: `cd apps/mobile && npx tsc --noEmit`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src apps/mobile/app.json apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "feat(mobile): add walk tab with location-backed start and finish"
```

---

### Task 6: iOS E2E evidence

**Files:**
- Create: `docs/logs/20260815115403-r1-step3-active-walk/screenshots/ios-walk-ready-location.png`
- Create: `docs/logs/20260815115403-r1-step3-active-walk/screenshots/ios-walk-startable.png`
- Create: `docs/logs/20260815115403-r1-step3-active-walk/screenshots/ios-walk-starting.png`
- Create: `docs/logs/20260815115403-r1-step3-active-walk/screenshots/ios-walk-recording.png`
- Create: `docs/logs/20260815115403-r1-step3-active-walk/screenshots/ios-walk-completed.png`
- Create: `docs/logs/20260815115403-r1-step3-active-walk/screenshots/ios-walk-failed.png`
- Create: `docs/logs/20260815115403-r1-step3-active-walk/e2e-report.md`

**Interfaces:**
- Consumes: local API（migration 0003–0005 適用済み）、Cognito OTP、iPhone simulator development client（`expo-maps` は Expo Go では動かない）
- Produces: 位置情報不足、Start 可能、Starting、Recording、Completed、Failed の PNG とレポート

入力エラー証跡は Idle の無効ボタンだけにしない。`ios-walk-ready-location.png` に「位置情報（使用中および常に）を許可してください。」が見えること。Dog 未選択で撮る場合は「Dog を1頭以上選んでください。」が見えること。

- [ ] **Step 1: Confirm AWS SSO before Verify**

Run: `aws sts get-caller-identity --profile walk-dog`

失敗したら `aws sso login --profile walk-dog` を出して停止する。Verify へ進めるのは成功後だけ。

- [ ] **Step 2: Apply migration and boot API + Metro**

`apps/api` で `npm run migrate` のあと `npm run dev`。モバイルは既存 development client。`expo-location` / `expo-maps` を入れたので native rebuild が必要なら EAS/dev client を作り直してから撮る。

- [ ] **Step 3: Capture required states**

Sign In → 表示名済み → Walk タブ。Dog が無ければ登録してから Walk に戻る。位置情報不足メッセージ。許可後の地図と現在地と Start。開始中。Recording。Finish 後 Completed（距離 0）。許可取り消しまたは Active 消失後の Failed。

- [ ] **Step 4: Write e2e-report.md**

`recording-ios-e2e-evidence` に従い、コマンド、各 PNG、`POST /v1/walks` 201 と `POST .../finish` 200（`distanceMeters: 0`）を記載する。

- [ ] **Step 5: Commit**

```bash
git add docs/logs/20260815115403-r1-step3-active-walk/screenshots \
  docs/logs/20260815115403-r1-step3-active-walk/e2e-report.md
git commit -m "docs: record Active Walk iOS evidence"
```

---

## Self-review

1. **Spec coverage:** GET active 200/204、POST start 201 + Idempotency、POST finish 距離 0、400/401/404/409 envelope、Owner あたり recording 1、Sign Out failIfPresent、Dogs/Walk タブ、Ready–Failed、地図と現在地、iOS 証跡 → Tasks 1–6。TrackPoint / Event / 経路 / Walk Detail / Owner タブは含めない。
2. **Placeholders:** なし。
3. **Type consistency:** `RecordingWalk` / `CompletedWalk` / `WalkRepository` / `StartWalk` / `FinishWalk` / `GetActiveWalk` を全 Task で同じ名前。`ActiveWalkCommands.failIfPresent` の signature は変えない。
