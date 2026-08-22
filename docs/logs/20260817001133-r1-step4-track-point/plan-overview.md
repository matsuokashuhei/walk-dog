<!-- Split index: this file | plan-tasks-3-4.md | plan-tasks-5.md | plan-tasks-6-7.md -->
# R1 Step 4 TrackPoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recording 中の Owner が 10秒ごとに位置を送り、API が TrackPoint を SQS へ受理し、worker が DynamoDB へ確定し、Recording 画面が現在地ピンと端末上の経路を出す。

**Architecture:** TrackPoint は既存 `walks` module が POST する。受理行は PostgreSQL、配送は SQS Standard、確定は worker の DynamoDB（キー `walkId` + `recordedAt`）。モバイルは `lib/walk-api.ts` と Walk 永続送信キューを使い、経路は端末が保持する点を `recordedAt` 順に結ぶ。worker は同一 API package の第二 process（`node dist/worker.js`）。

**Tech Stack:** Hono、`@hono/zod-openapi`、Zod 4、Drizzle、AWS SDK v3 SQS / DynamoDB、ElasticMQ、DynamoDB Local、Expo Location / TaskManager / Maps、Node.js test runner

**Spec:** `docs/logs/20260817001133-r1-step4-track-point/design.md`、`track-point-api-spec.html`、`track-point-spec-mockups.html`

## Global Constraints

- 公開契約は `track-point-api-spec.html` と `track-point-spec-mockups.html` に従う。
- `POST /v1/walks/:walkId/track-points` 成功は 201。body は `{ recordedAt, latitude, longitude }` のみ。`sequence` と `Idempotency-Key` は置かない。
- 201 body は `{ requestId, trackPointId, walkId, recordedAt, latitude, longitude }`。`recordedAt` は ISO 8601 UTC。
- 冪等の正本は `walkId` + `recordedAt`。同一座標の再送は受理済み TrackPoint。座標が違うときは 409 `IDEMPOTENCY_CONFLICT`、message「同じ取得時刻の TrackPoint が別の内容で送られています。」、`retryable: false`。
- 入力不正は 400 `INVALID_INPUT`、message「入力内容を確認してください。」、`retryable: false`。
- 認証ゲート失敗は 401 `UNAUTHENTICATED`、message「Authentication is required.」、`retryable: false`。
- 別 Owner / 未知 `walkId` / 非 UUID `walkId` は 404 `NOT_FOUND`、message「Walk が見つかりません。」、`retryable: false`。
- `recording` ではない Walk は 409 `WALK_NOT_RECORDING`、message「この Walk は記録中ではありません。」、`retryable: false`。
- この endpoint の 5xx は `INTERNAL_ERROR`、message「一時的に送信できません。」、`retryable: true`。route が SQS 失敗を捕捉する。`app.onError` の `retryable: false` に落とさない。
- 429 は契約上 `retryable: true`。この縦切りでは rate limiter を追加しない。モバイルは `retryable` を見て再送する。
- `GET /health` は API process、worker process、PostgreSQL が稼働中なら 200 `{ status: "ok" }`。worker または PostgreSQL の再試行可能な接続状態は 503 `DEPENDENCY_UNAVAILABLE`、message「A required dependency is unavailable.」、`retryable: true`。
- HTTP 201 は worker の DynamoDB 確定を待たない。replay は PostgreSQL の受理行を返す。replay でも SQS へ送る。
- DynamoDB は `walkId` + `recordedAt` ごとに 1 件。重複・順序違い・再配送は同じキーへ畳む。
- Recording の経路データソースは端末が保持する点。GET TrackPoints API は作らない。
- 自動再送は Walk が `recording` のあいだ回数上限なし。Finish / Failed / Ready では止める。未受理点は端末に残す（吐き出しは縦切り 5）。
- この縦切りの Finish は確定待ちをしない。距離は 0。Event、Walk Detail 経路、距離 / pace の経路由来値、S3 / RustFS は含めない。
- Starting は画面状態のまま。API の `starting` 永続化はしない。
- use case は Hono / Zod / AWS SDK / Drizzle を import しない。
- collaborator は required 注入。Quiet no-op を production factory に埋めない。
- モバイル HTTP は `lib/walk-api.ts`。画面は `apiRequest` を直接呼ばない。
- SQL migration は 1 ファイル 1 `CREATE TABLE`。`drizzle-kit push` は使わない。
- コマンドは指定がなければ `apps/api` または `apps/mobile` から実行する。
- 各 Task は targeted test → 関連 gate → commit。

## File map

| File | Responsibility |
| --- | --- |
| `apps/api/src/infrastructure/database/schema/walk-track-point.ts` | 受理行。`(walk_id, recorded_at)` 一意 |
| `apps/api/drizzle/0006_create_walk_track_points.sql` | `CREATE TABLE` 1 つ |
| `apps/api/src/modules/walks/types.ts` | `TrackPoint`、`AcceptTrackPoint`、`AcceptTrackPointInput` |
| `apps/api/src/modules/walks/provider.ts` | `TrackPointQueue`、`ConfirmTrackPoint` |
| `apps/api/src/modules/walks/repository.ts` | `acceptTrackPoint` |
| `apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts` | 受理行の insert / replay |
| `apps/api/src/infrastructure/config/index.ts` | SQS、DynamoDB、worker health の load |
| `apps/api/src/infrastructure/sqs/client.ts` | 長寿命 SQS client |
| `apps/api/src/infrastructure/sqs/enqueue-track-point.ts` | `SendMessage` adapter |
| `apps/api/src/infrastructure/dynamodb/client.ts` | 長寿命 DynamoDB client |
| `apps/api/src/infrastructure/dynamodb/confirm-track-point.ts` | 条件付き put adapter |
| `apps/api/src/modules/walks/use-cases/accept-track-point.ts` | Owner 解決 → 受理 → enqueue |
| `apps/api/src/modules/walks/routes/accept-track-point.ts` | POST `/{walkId}/track-points` |
| `apps/api/src/modules/health/*` | API + worker + PostgreSQL の確認 |
| `apps/api/src/worker.ts` | SQS long poll、worker `/health`、shutdown |
| `apps/compose.yml` | ElasticMQ、DynamoDB Local、worker |
| `apps/mobile/src/lib/walk-api.ts` | `postTrackPoint` |
| `apps/mobile/src/lib/walk-track-point-queue.ts` | 未受理点の永続キューと再送判定 |
| `apps/mobile/src/lib/walk-path-store.ts` | 経路点の永続化 |
| `apps/mobile/src/lib/walk-location-task.ts` | 10秒間隔の位置取得（Background 含む） |
| `apps/mobile/src/app/(app)/(tabs)/walk.tsx` | ピンと polyline |

## Shared types (all tasks)

```ts
export type TrackPoint = {
  trackPointId: string
  walkId: string
  recordedAt: Date
  latitude: number
  longitude: number
}

export type AcceptTrackPointInput = {
  ownerId: string
  walkId: string
  recordedAt: Date
  latitude: number
  longitude: number
}

export type AcceptTrackPoint = (input: {
  cognitoSubject: string
  walkId: string
  recordedAt: Date
  latitude: number
  longitude: number
}) => Promise<
  | { ok: true; trackPoint: TrackPoint }
  | { ok: false; error: 'not_found' | 'walk_not_recording' | 'idempotency_conflict' }
>

export type TrackPointQueue = {
  enqueue(message: TrackPoint): Promise<void>
}

export type ConfirmTrackPoint = {
  confirm(message: TrackPoint): Promise<void>
}

export type SqsConfig = {
  region: string
  queueUrl: string
  endpoint: string | undefined
}

export type DynamoDbConfig = {
  region: string
  tableName: string
  endpoint: string | undefined
}

export type WorkerHealthConfig = {
  workerHealthUrl: string
}
```

SQS message body は JSON:

```json
{
  "trackPointId": "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90",
  "walkId": "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80",
  "recordedAt": "2026-08-17T03:12:14.000Z",
  "latitude": 35.681236,
  "longitude": 139.767125
}
```

DynamoDB item: partition `walkId` (S)、sort `recordedAt` (S、ISO)、属性 `trackPointId` (S)、`latitude` (N)、`longitude` (N)。

座標の同一判定は受理時に受け取った number の一致（`===`）。

## Task-to-design traceability

| Design 受け入れ | Task |
| --- | --- |
| `(walk_id, recorded_at)` 一意の受理行 | 1, 2 |
| POST 201 / replay / 409 conflict / 400 / 401 / 404 / 409 not recording | 2, 4 |
| SQS 送信、replay でも送る、5xx retryable | 3, 4 |
| worker 1 キー 1 件、重複・順序違い・再配送 | 5 |
| GET /health 200 / 503 | 5 |
| Compose ElasticMQ + DynamoDB Local + worker | 5 |
| 10秒取得、ピン、経路、Background、自動再送 | 6 |
| iOS 証跡 | 7 |

---

### Task 1: walk_track_points schema and migration

**Files:**
- Create: `apps/api/src/infrastructure/database/schema/walk-track-point.ts`
- Create: `apps/api/drizzle/0006_create_walk_track_points.sql`（generate 後に 1 `CREATE TABLE` であることを確認）
- Modify: `apps/api/drizzle/meta/_journal.json` と snapshot（generate の結果）

**Interfaces:**
- Consumes: `walks.walkId`、既存 drizzle-kit config（`schema: './src/infrastructure/database/schema/*.ts'`）
- Produces: `walkTrackPoints` table export

実装前に https://orm.drizzle.team/docs/sql-schema-declaration と https://orm.drizzle.team/docs/column-types/pg と https://orm.drizzle.team/docs/indexes-constraints と https://orm.drizzle.team/docs/drizzle-kit-generate を読む。セッション log に URL を残す。

- [ ] **Step 1: Write the schema file**

```ts
import { doublePrecision, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { walks } from './walk.js'

export const walkTrackPoints = pgTable('walk_track_points', {
  trackPointId: uuid('track_point_id').primaryKey().$default(() => uuidv7()),
  walkId: uuid('walk_id').notNull().references(() => walks.walkId),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('walk_track_points_walk_id_recorded_at_unique').on(table.walkId, table.recordedAt),
])
```

このテーブルが持つ公開契約は HTTP TrackPoint（`trackPointId`、`walkId`、`recordedAt`、`latitude`、`longitude`）である。

- [ ] **Step 2: Generate SQL**

Run: `cd apps/api && npx drizzle-kit generate --name=create_walk_track_points`

Expected: `0006_create_walk_track_points.sql` に `CREATE TABLE "walk_track_points"` が 1 つ。PK、`walk_id` FK、`(walk_id, recorded_at)` unique、`recorded_at` timestamptz、緯度経度 double precision。`CREATE TABLE` が複数ある場合は split する。

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && npx tsc --noEmit`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/infrastructure/database/schema/walk-track-point.ts apps/api/drizzle
git commit -m "feat(api): add walk_track_points acceptance table"
```

---

### Task 2: WalkRepository.acceptTrackPoint

**Files:**
- Modify: `apps/api/src/modules/walks/types.ts`
- Modify: `apps/api/src/modules/walks/repository.ts`
- Modify: `apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts`
- Modify: `apps/api/test/infrastructure/database/drizzle-walk-repository.test.ts`
- Modify: `apps/api/test/infrastructure/database/walk-repository-fake.ts`（`walkTrackPoints` の insert/select が通る範囲）
- Modify: `apps/api/test/modules/walks/use-cases/*.ts` の `walksFake` に `acceptTrackPoint` を追加（型を通す）

**Interfaces:**
- Consumes: `DbInstance`、`walks`、`walkTrackPoints`
- Produces:

```ts
export interface WalkRepository {
  getActiveByOwner(ownerId: string): Promise<RecordingWalk | null>
  start(input: StartWalkInput): Promise<RecordingWalk>
  finish(input: FinishWalkInput): Promise<CompletedWalk>
  fail(input: { ownerId: string; walkId: string }): Promise<void>
  failIfPresent(input: { ownerId: string }): Promise<void>
  acceptTrackPoint(input: AcceptTrackPointInput): Promise<TrackPoint>
}
```

`acceptTrackPoint` は Walk が無ければ `WalkNotFoundError`、Owner 不一致も `WalkNotFoundError`、`state !== 'recording'` なら `WalkNotRecordingError`。新規なら `trackPointId` を発行して insert。`(walk_id, recorded_at)` の `23505` は既存行を読み、座標が同じならその行を返し、違えば `IdempotencyConflictError`。

- [ ] **Step 1: Write failing repository tests**

`test/infrastructure/database/drizzle-walk-repository.test.ts` に追加する。既存 fake を使う。

```ts
const recordedAt = new Date('2026-08-17T03:12:14.000Z')
const trackPointInput = {
  ownerId,
  walkId,
  recordedAt,
  latitude: 35.681236,
  longitude: 139.767125,
}
const trackPointRow = {
  trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId,
  recordedAt,
  latitude: 35.681236,
  longitude: 139.767125,
  createdAt: recordedAt,
}
const expectedTrackPoint = {
  trackPointId: trackPointRow.trackPointId,
  walkId,
  recordedAt,
  latitude: 35.681236,
  longitude: 139.767125,
}

test('acceptTrackPoint inserts an accepted point for a recording walk', async () => {
  const { database, insertTables } = createWalkDatabaseFake({
    selectResults: [[recordingWalkRow]],
    insertResults: [[trackPointRow]],
  })
  assert.deepEqual(
    await createDrizzleWalkRepository(database).acceptTrackPoint(trackPointInput),
    expectedTrackPoint,
  )
  assert.equal(insertTables.includes(walkTrackPoints) || insertTables.at(-1), walkTrackPoints)
})

test('acceptTrackPoint returns the existing point when recordedAt and coordinates match', async () => {
  const { database } = createWalkDatabaseFake({
    selectResults: [[recordingWalkRow]],
    insertError: uniqueViolation('walk_track_points_walk_id_recorded_at_unique'),
  })
  // fake は unique 後に既存行 select を返すよう selectResults を組む
})

test('acceptTrackPoint throws IdempotencyConflictError when recordedAt matches and coordinates differ', async () => {
  // 既存行の latitude/longitude をずらして投入する
})

test('acceptTrackPoint throws WalkNotFoundError when the walk is missing or owned by someone else', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).acceptTrackPoint(trackPointInput),
    WalkNotFoundError,
  )
})

test('acceptTrackPoint throws WalkNotRecordingError when the walk is completed', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[completedWalkRow]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).acceptTrackPoint(trackPointInput),
    WalkNotRecordingError,
  )
})
```

failed Walk でも `WalkNotRecordingError`。replay の select は unique 衝突のあと `(walk_id, recorded_at)` で既存行を取る。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --import tsx --test test/infrastructure/database/drizzle-walk-repository.test.ts`

Expected: FAIL（`acceptTrackPoint` 未定義）

- [ ] **Step 3: Implement acceptTrackPoint**

1. `walks` を `walkId` で取る。無ければ `WalkNotFoundError`。`ownerId` 不一致も `WalkNotFoundError`。
2. `state !== 'recording'` なら `WalkNotRecordingError`。
3. `walkTrackPoints` へ insert。
4. unique 衝突なら既存行を読み、`latitude` / `longitude` が同じなら返す。違うなら `IdempotencyConflictError`。

公式: https://orm.drizzle.team/docs/insert

既存 use-case fake の `WalkRepository` オブジェクトすべてに、

```ts
async acceptTrackPoint() {
  throw new Error('unexpected acceptTrackPoint')
}
```

を足す。

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && node --import tsx --test test/infrastructure/database/drizzle-walk-repository.test.ts test/modules/walks/use-cases`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/walks/types.ts \
  apps/api/src/modules/walks/repository.ts \
  apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts \
  apps/api/test
git commit -m "feat(api): accept TrackPoints with recordedAt idempotency"
```

---

