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

### Task 3: SQS config and enqueue adapter

**Files:**
- Modify: `apps/api/src/infrastructure/config/index.ts`
- Modify: `apps/api/test/config.test.ts`
- Create: `apps/api/src/modules/walks/provider.ts`
- Create: `apps/api/src/infrastructure/sqs/client.ts`
- Create: `apps/api/src/infrastructure/sqs/enqueue-track-point.ts`
- Test: `apps/api/test/infrastructure/sqs/enqueue-track-point.test.ts`
- Modify: `apps/api/package.json` / lockfile（`@aws-sdk/client-sqs`）

**Interfaces:**
- Consumes: `SqsConfig`、注入された `SQSClient`（または `send(command)`）
- Produces: `loadSqsConfig`、`createSqsClient`、`createEnqueueTrackPoint(client, config): TrackPointQueue`

実装前に https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html を読む。

- [ ] **Step 1: Write failing config and adapter tests**

```ts
const validSqsEnv = {
  AWS_REGION: 'ap-northeast-1',
  SQS_QUEUE_URL: 'http://localhost:9324/queue/track-points',
  SQS_ENDPOINT: 'http://localhost:9324',
}

test('loads SQS_QUEUE_URL, AWS_REGION, and SQS_ENDPOINT', () => {
  assert.deepEqual(loadSqsConfig(validSqsEnv), {
    region: 'ap-northeast-1',
    queueUrl: 'http://localhost:9324/queue/track-points',
    endpoint: 'http://localhost:9324',
  })
})

test('treats blank SQS_ENDPOINT as undefined', () => {
  assert.equal(loadSqsConfig({ ...validSqsEnv, SQS_ENDPOINT: '' }).endpoint, undefined)
})

test('rejects a missing SQS_QUEUE_URL', () => {
  const env = { ...validSqsEnv }
  delete (env as { SQS_QUEUE_URL?: string }).SQS_QUEUE_URL
  assert.throws(() => loadSqsConfig(env), /SQS_QUEUE_URL/)
})
```

adapter:

```ts
test('enqueue sends the TrackPoint JSON to the configured queue URL', async () => {
  const sent: unknown[] = []
  const queue = createEnqueueTrackPoint(
    { send: async (command) => { sent.push(command); return {} } },
    {
      region: 'ap-northeast-1',
      queueUrl: 'http://localhost:9324/queue/track-points',
      endpoint: 'http://localhost:9324',
    },
  )
  await queue.enqueue({
    trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
    walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
    recordedAt: new Date('2026-08-17T03:12:14.000Z'),
    latitude: 35.681236,
    longitude: 139.767125,
  })
  const command = sent[0] as SendMessageCommand
  assert.equal(command.input.QueueUrl, 'http://localhost:9324/queue/track-points')
  assert.equal(
    command.input.MessageBody,
    JSON.stringify({
      trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
      walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
      recordedAt: '2026-08-17T03:12:14.000Z',
      latitude: 35.681236,
      longitude: 139.767125,
    }),
  )
})
```

adapter は SDK exception を機能 outcome に畳まない。失敗はそのまま throw する。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --import tsx --test test/config.test.ts test/infrastructure/sqs/enqueue-track-point.test.ts`

Expected: FAIL（`loadSqsConfig` / adapter 未定義）

- [ ] **Step 3: Install SDK and implement**

Run: `cd apps/api && npm install @aws-sdk/client-sqs`

`loadSqsConfig` は `AWS_REGION`、`SQS_QUEUE_URL` 必須。`SQS_ENDPOINT` は空文字を `undefined`。

`createSqsClient(config)` は process lifetime の `SQSClient`。`endpoint` があるときだけ `endpoint` を渡す。adapter 内で client を new しない。

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && node --import tsx --test test/config.test.ts test/infrastructure/sqs/enqueue-track-point.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/infrastructure/config/index.ts \
  apps/api/src/modules/walks/provider.ts \
  apps/api/src/infrastructure/sqs \
  apps/api/test/config.test.ts \
  apps/api/test/infrastructure/sqs \
  apps/api/package.json apps/api/package-lock.json
git commit -m "feat(api): enqueue accepted TrackPoints to SQS"
```

---

### Task 4: Accept TrackPoint use case and route

**Files:**
- Modify: `apps/api/src/modules/walks/contracts.ts`
- Modify: `apps/api/src/modules/walks/walk-response.ts`（`toTrackPointResponse`）
- Create: `apps/api/src/modules/walks/use-cases/accept-track-point.ts`
- Create: `apps/api/src/modules/walks/routes/accept-track-point.ts`
- Modify: `apps/api/src/modules/walks/routes/index.ts`
- Modify: `apps/api/src/modules/walks/index.ts`
- Modify: `apps/api/src/index.ts`（queue 生成、use case 注入、SQS client を resources へ、shutdown は Task 5 でも可。この Task で `createApplication` が SQS を組む）
- Modify: `apps/api/src/server.ts`（SQS client destroy を shutdown に足す）
- Modify: `apps/api/test/composition.test.ts`
- Modify: `apps/api/test/openapi.test.ts`（`/v1/walks/{walkId}/track-points` POST `201,400,401,404,409,500`）
- Modify: `apps/api/test/modules/walks/fixtures.ts`
- Test: `apps/api/test/modules/walks/use-cases/accept-track-point.test.ts`
- Test: `apps/api/test/modules/walks/routes/accept-track-point.test.ts`

**Interfaces:**
- Consumes: `OwnerRepository.resolveByCognitoSubject`、`WalkRepository.acceptTrackPoint`、`TrackPointQueue.enqueue`
- Produces: `createAcceptTrackPoint`、`registerAcceptTrackPointRoute`、`WalkRouteDependencies.acceptTrackPoint`

Zod body:

```ts
export const acceptTrackPointRequestSchema = z.strictObject({
  recordedAt: z.iso.datetime(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
})
```

path は既存どおり `walkIdParamSchema`。OpenAPI path は `/{walkId}/track-points`。

- [ ] **Step 1: Write failing use case tests**

```ts
test('acceptTrackPoint resolves the owner, accepts, enqueues, and returns the point', async () => {
  const accepted: AcceptTrackPointInput[] = []
  const enqueued: TrackPoint[] = []
  const accept = createAcceptTrackPoint(
    ownersFake(async () => owner),
    walksFake(async (input) => {
      accepted.push(input)
      return expectedTrackPoint
    }),
    { enqueue: async (message) => { enqueued.push(message) } },
  )
  assert.deepEqual(
    await accept({
      cognitoSubject: 'sub-1',
      walkId,
      recordedAt,
      latitude: 35.681236,
      longitude: 139.767125,
    }),
    { ok: true, trackPoint: expectedTrackPoint },
  )
  assert.deepEqual(enqueued, [expectedTrackPoint])
})

test('acceptTrackPoint maps WalkNotFoundError to not_found and does not enqueue', async () => {
  // walks.acceptTrackPoint throws WalkNotFoundError → { ok: false, error: 'not_found' }
})

test('acceptTrackPoint maps WalkNotRecordingError to walk_not_recording', async () => {})
test('acceptTrackPoint maps IdempotencyConflictError to idempotency_conflict', async () => {})
test('acceptTrackPoint enqueues on replay of the same coordinates', async () => {
  // repository が既存 TrackPoint を返す。enqueue は 1 回呼ばれる
})
```

enqueue が throw したら use case も throw する（route が 500 retryable）。

- [ ] **Step 2: Write failing route tests**

`createWalkApp` に authentication と `registerAcceptTrackPointRoute` を載せる。`fixtures.ts` の `WalkRouteDependencies` 利用箇所へ `unusedAcceptTrackPoint` を足す。

```ts
const path = `/v1/walks/${walk.walkId}/track-points`
const body = {
  recordedAt: '2026-08-17T03:12:14.000Z',
  latitude: 35.681236,
  longitude: 139.767125,
}

test('POST track-points returns 201 TrackPoint', async () => {
  const response = await createAcceptApp(async () => ({ ok: true, trackPoint: expectedTrackPoint }))
    .request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  const json = await response.json() as { trackPointId: string; recordedAt: string }
  assert.equal(response.status, 201)
  assert.equal(json.trackPointId, expectedTrackPoint.trackPointId)
  assert.equal(json.recordedAt, '2026-08-17T03:12:14.000Z')
})

test('POST track-points returns 401 without Authorization', async () => {})
test('POST track-points returns 400 INVALID_INPUT for missing recordedAt', async () => {})
test('POST track-points returns 400 for latitude 91', async () => {})
test('POST track-points returns 404 Walk が見つかりません。', async () => {})
test('POST track-points returns 409 WALK_NOT_RECORDING この Walk は記録中ではありません。', async () => {})
test('POST track-points returns 409 IDEMPOTENCY_CONFLICT 同じ取得時刻の TrackPoint が別の内容で送られています。', async () => {})
test('POST track-points returns 500 INTERNAL_ERROR retryable true when accept throws', async () => {
  const response = await createAcceptApp(async () => { throw new Error('sqs') })
    .request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  const json = await response.json() as { code: string; message: string; retryable: boolean }
  assert.equal(response.status, 500)
  assert.equal(json.code, 'INTERNAL_ERROR')
  assert.equal(json.message, '一時的に送信できません。')
  assert.equal(json.retryable, true)
})
```

authorizedHeaders は `Authorization`、`Content-Type`、`Accept`。`Idempotency-Key` は送らない。

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/api && node --import tsx --test test/modules/walks/use-cases/accept-track-point.test.ts test/modules/walks/routes/accept-track-point.test.ts`

Expected: FAIL

- [ ] **Step 4: Implement use case, route, and composition**

use case: Owner 解決 → `walks.acceptTrackPoint` → `queue.enqueue` → `{ ok: true, trackPoint }`。既知 error だけ mapping。

route: `recordedAt` を `new Date(...)` にして use case へ。成功は `toTrackPointResponse`。catch した未知 error は 500 retryable true。

`createApplication`:

1. `loadSqsConfig` を `loadConfigs` に足す。
2. `createSqsClient` → `createEnqueueTrackPoint`。
3. `createAcceptTrackPoint(ownerRepository, walkRepository, queue)`。
4. `WalkRouteDependencies.acceptTrackPoint`。
5. `resources` に SQS client。`server.ts` shutdown で `destroy()`。

`composition.test.ts` の factory と call 順に SQS / accept を足す。`openapi.test.ts` の `expectedOperations` に POST track-points を足す。

- [ ] **Step 5: Run API tests**

Run: `cd apps/api && npm test`

Expected: PASS（既存 health はまだ API only の 200）

- [ ] **Step 6: Commit**

```bash
git add apps/api/src apps/api/test apps/api/package.json apps/api/package-lock.json
git commit -m "feat(api): accept TrackPoints over POST /v1/walks/:walkId/track-points"
```

---

### Task 5: Worker, DynamoDB, Compose, and GET /health

**Files:**
- Modify: `apps/api/src/infrastructure/config/index.ts`（`loadDynamoDbConfig`、`loadWorkerHealthConfig`）
- Create: `apps/api/src/infrastructure/dynamodb/client.ts`
- Create: `apps/api/src/infrastructure/dynamodb/confirm-track-point.ts`
- Create: `apps/api/src/infrastructure/dynamodb/ensure-table.ts`
- Create: `apps/api/src/worker.ts`
- Modify: `apps/api/src/modules/health/contracts.ts`
- Modify: `apps/api/src/modules/health/routes/health.ts`
- Modify: `apps/api/src/modules/health/index.ts`
- Create: `apps/api/src/modules/health/use-cases/check-health.ts`
- Modify: `apps/api/src/index.ts`（`createHealthRoutes({ checkHealth })`）
- Modify: `apps/api/src/server.ts`（必要なら）
- Modify: `apps/api/package.json`（`@aws-sdk/client-dynamodb`、`worker` script、knip entry）
- Modify: `apps/api/knip.json`（`src/worker.ts`）
- Modify: `apps/compose.yml`
- Create: `apps/elasticmq.conf`（queue `track-points`）
- Modify: `apps/api/test/app.test.ts`、`test/composition.test.ts`、`test/config.test.ts`、`test/openapi.test.ts`
- Test: `apps/api/test/infrastructure/dynamodb/confirm-track-point.test.ts`
- Test: `apps/api/test/modules/health/check-health.test.ts`
- Test: `apps/api/test/worker.test.ts`

**Interfaces:**
- Consumes: SQS `ReceiveMessage` / `DeleteMessage`、DynamoDB `PutItem`、`Pool.query('select 1')`、`WORKER_HEALTH_URL`
- Produces: worker process、Compose 3 サービス追加、`GET /health` の三者確認

実装前に https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ReceiveMessage.html と https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html を読む。

- [ ] **Step 1: Write failing DynamoDB adapter tests**

```ts
test('confirm puts walkId+recordedAt and treats ConditionalCheckFailed as already confirmed', async () => {
  const sent: unknown[] = []
  const store = createConfirmTrackPoint(
    { send: async (command) => { sent.push(command); return {} } },
    { region: 'ap-northeast-1', tableName: 'TrackPoints', endpoint: 'http://localhost:8000' },
  )
  await store.confirm({
    trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
    walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
    recordedAt: new Date('2026-08-17T03:12:14.000Z'),
    latitude: 35.681236,
    longitude: 139.767125,
  })
  const command = sent[0] as PutItemCommand
  assert.equal(command.input.TableName, 'TrackPoints')
  assert.equal(command.input.Item?.walkId.S, '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80')
  assert.equal(command.input.Item?.recordedAt.S, '2026-08-17T03:12:14.000Z')
  assert.equal(command.input.ConditionExpression, 'attribute_not_exists(walkId)')
})

test('confirm resolves when PutItem fails with ConditionalCheckFailedException', async () => {
  const err = new Error('conditional')
  err.name = 'ConditionalCheckFailedException'
  const store = createConfirmTrackPoint(
    { send: async () => { throw err } },
    { region: 'ap-northeast-1', tableName: 'TrackPoints', endpoint: undefined },
  )
  await store.confirm({ /* 同じ TrackPoint */ })
})
```

SDK の `ConditionalCheckFailedException` class で判定する。name 文字列の広い比較だけにしない。

- [ ] **Step 2: Write failing health tests**

`registerHealthRoutes` は `{ checkHealth }` 必須。

```ts
test('GET /health returns 200 when API, worker, and postgres are up', async () => {
  const app = createApp(appDependencies, [{
    path: '/',
    app: registerHealthRoutes({ checkHealth: async () => ({ ok: true }) }),
  }])
  const response = await app.request('/health')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('GET /health returns 503 DEPENDENCY_UNAVAILABLE when a dependency is down', async () => {
  const app = createApp(appDependencies, [{
    path: '/',
    app: registerHealthRoutes({ checkHealth: async () => ({ ok: false }) }),
  }])
  const response = await app.request('/health', { headers: { 'X-Request-Id': 'health-1' } })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'A required dependency is unavailable.',
    requestId: 'health-1',
    retryable: true,
  })
})
```

`createCheckHealth`:

```ts
test('checkHealth is ok when postgres and worker succeed', async () => {
  const check = createCheckHealth({
    pingPostgres: async () => {},
    pingWorker: async () => {},
  })
  assert.deepEqual(await check(), { ok: true })
})

test('checkHealth is not ok when worker ping throws', async () => {
  const check = createCheckHealth({
    pingPostgres: async () => {},
    pingWorker: async () => { throw new Error('down') },
  })
  assert.deepEqual(await check(), { ok: false })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/api && node --import tsx --test test/infrastructure/dynamodb/confirm-track-point.test.ts test/modules/health/check-health.test.ts test/app.test.ts`

Expected: FAIL

- [ ] **Step 4: Implement worker, health, and Compose**

`npm install @aws-sdk/client-dynamodb`

`loadDynamoDbConfig`: `AWS_REGION`、`DYNAMODB_TABLE` 必須。`DYNAMODB_ENDPOINT` 空は `undefined`。

`loadWorkerHealthConfig`: `WORKER_HEALTH_URL` 必須（API process）。

worker は `WORKER_HEALTH_PORT` 必須。`node:http` で `GET /health` → `{ status: "ok" }`。

worker 起動:

1. config load
2. SQS / DynamoDB client
3. `ensureTrackPointsTable`（無ければ `CreateTable`。キー `walkId` HASH + `recordedAt` RANGE。PAY_PER_REQUEST）
4. health listener
5. loop: `ReceiveMessage` `WaitTimeSeconds: 20`、`MaxNumberOfMessages: 1` → JSON を `TrackPoint` に変換 → `confirm` → `DeleteMessage`
6. SIGINT/SIGTERM で新規 poll を止め、処理中を確定し、listener と AWS client を閉じる

不正 JSON の message は削除せず visibility に任せる（poison の専用画面は作らない。ログする）。

`package.json`:

```json
"worker": "tsx watch --import ./src/instrument.ts src/worker.ts",
"start:worker": "node --import ./dist/instrument.js dist/worker.js"
```

`knip.json` entry に `src/worker.ts`。

Compose 追加:

```yaml
elasticmq:
  image: softwaremill/elasticmq-native
  ports:
    - "9324:9324"
  volumes:
    - ./elasticmq.conf:/opt/elasticmq.conf

dynamodb:
  image: amazon/dynamodb-local
  command: ["-jar", "DynamoDBLocal.jar", "-sharedDb", "-inMemory"]
  ports:
    - "8000:8000"

worker:
  build: ./api
  command: npm run worker
  env_file: .env.local
  depends_on:
    - elasticmq
    - dynamodb
  expose:
    - "3001"
```

`apps/elasticmq.conf` に queue `track-points`（`receiveMessageWait = 20 seconds`）。

`.env.local` に次を足す（値は開発用）:

```
SQS_QUEUE_URL=http://elasticmq:9324/queue/track-points
SQS_ENDPOINT=http://elasticmq:9324
DYNAMODB_TABLE=TrackPoints
DYNAMODB_ENDPOINT=http://dynamodb:8000
WORKER_HEALTH_URL=http://worker:3001/health
WORKER_HEALTH_PORT=3001
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
```

host から API を直接起動する場合の URL は `localhost`。`api` service の `depends_on` に `worker` は必須にしない（health が 503 を返せば足りる）。`api` は ElasticMQ に送るので `elasticmq` を `depends_on` する。

`createHealthRoutes` の引数追加に合わせて `app.test.ts` / `composition.test.ts` / walk `fixtures.ts` の `registerHealthRoutes()` を更新する。openapi の `/health` に `503` を足す。

- [ ] **Step 5: Run API tests and knip**

Run: `cd apps/api && npm test && npx knip && npx tsc --noEmit`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api apps/compose.yml apps/elasticmq.conf
git commit -m "feat(api): confirm TrackPoints in the worker and check health"
```

---

### Task 6: Mobile 10s send, pin, and path

**Files:**
- Modify: `apps/mobile/src/lib/walk-api.ts`
- Create: `apps/mobile/src/lib/walk-track-point-queue.ts`
- Create: `apps/mobile/src/lib/walk-path-store.ts`
- Create: `apps/mobile/src/lib/walk-location-task.ts`
- Modify: `apps/mobile/src/app/(app)/(tabs)/walk.tsx`
- Modify: `apps/mobile/app.json`（`expo-task-manager` plugin）
- Modify: `apps/mobile/package.json` / lockfile（`expo-file-system`、`expo-task-manager`）
- Test: `apps/mobile/src/lib/walk-track-point-queue.test.ts`

**Interfaces:**
- Consumes: `postTrackPoint`、`ApiError.retryable` / `status`、FileSystem、`Location.startLocationUpdatesAsync`
- Produces: Recording 中の 10秒取得、ピン、polyline、Background 継続、retryable 自動再送

実装前に https://docs.expo.dev/versions/v57.0.0/sdk/location/ と https://docs.expo.dev/versions/v57.0.0/sdk/maps/ を読む。

```ts
export type LocalTrackPoint = {
  walkId: string
  recordedAt: string
  latitude: number
  longitude: number
}

export function postTrackPoint(
  accessToken: string,
  input: LocalTrackPoint,
): Promise<TrackPointResponse> {
  return apiRequest(`/v1/walks/${input.walkId}/track-points`, {
    method: 'POST',
    accessToken,
    body: {
      recordedAt: input.recordedAt,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  })
}

export type TrackPointResponse = {
  requestId: string
  trackPointId: string
  walkId: string
  recordedAt: string
  latitude: number
  longitude: number
}

export function nextQueueAction(error: { status: number; retryable: boolean }): 'retry' | 'drop' | 'unauthenticated' {
  if (error.status === 401) {
    return 'unauthenticated'
  }
  if (error.retryable) {
    return 'retry'
  }
  return 'drop'
}
```

`drop` は 400 / 404 / 409。キューから外す。`retry` は残す。`unauthenticated` は自動再送を止め、既存の Failed / 再認証へ進む。

- [ ] **Step 1: Write failing queue tests**

`apps/mobile` で `npx tsx --test` できるよう、queue は RN を import しない。storage は注入する。

```ts
test('201 removes the point from the outbound queue and keeps it on the path', async () => {
  const path: LocalTrackPoint[] = []
  const queue: LocalTrackPoint[] = []
  const store = createTrackPointCoordinator({
    loadPath: async () => path,
    savePath: async (points) => { path.splice(0, path.length, ...points) },
    loadQueue: async () => queue,
    saveQueue: async (points) => { queue.splice(0, queue.length, ...points) },
    post: async () => ({ ok: true as const }),
  })
  const point = {
    walkId: 'w1',
    recordedAt: '2026-08-17T03:12:14.000Z',
    latitude: 35.68,
    longitude: 139.76,
  }
  await store.record(point)
  assert.deepEqual(path, [point])
  assert.deepEqual(queue, [])
})

test('retryable failure keeps the same point in the queue', async () => {
  const store = createTrackPointCoordinator({
    /* in-memory */ post: async () => ({ ok: false as const, status: 500, retryable: true }),
  })
  await store.record(point)
  assert.equal((await store.pending()).length, 1)
})

test('409 conflict is dropped from the queue', async () => {})
test('401 is unauthenticated and stops auto-retry', async () => {})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx tsx --test src/lib/walk-track-point-queue.test.ts`

Expected: FAIL。tsx が無ければ `npx --yes tsx --test src/lib/walk-track-point-queue.test.ts`。

- [ ] **Step 3: Implement client, stores, location task, and Recording map**

`npm install expo-file-system expo-task-manager`（SDK 57 互換 version）。`app.json` plugins に `expo-task-manager`。

永続ファイルは `documentDirectory` 配下。`walk-path.json` は walkId ごとの点配列。`walk-outbound-queue.json` は未受理点配列。

`walk-location-task.ts`:

- `TaskManager.defineTask('WALK_TRACK_POINT', ...)` を module load で登録する。
- Recording 開始で `Location.startLocationUpdatesAsync('WALK_TRACK_POINT', { timeInterval: 10000, distanceInterval: 0, accuracy: Location.Accuracy.Balanced, pausesUpdatesAutomatically: false })`。
- 各更新で `recordedAt = new Date(location.timestamp).toISOString()`、coords を `record()`。
- Finish / Failed / Ready で `Location.stopLocationUpdatesAsync('WALK_TRACK_POINT')`。キューは消さない。

`walk.tsx` Recording の `AppleMaps.View`:

```tsx
<AppleMaps.View
  style={styles.map}
  properties={{
    isMyLocationEnabled: true,
    selectionEnabled: false,
    pointsOfInterest: { including: [] },
  }}
  cameraPosition={cameraPosition}
  markers={currentPoint ? [{
    id: 'current',
    coordinates: { latitude: currentPoint.latitude, longitude: currentPoint.longitude },
  }] : []}
  polylines={pathCoordinates.length >= 2 ? [{
    id: 'walk-path',
    coordinates: pathCoordinates,
  }] : []}
/>
```

`pathCoordinates` は経路ストアを `recordedAt` 昇順。カメラは最新点。専用の失敗 UI は足さない。retryable 中も Recording のまま。

task を `_layout` または `walk.tsx` から import して define が評価されるようにする。

- [ ] **Step 4: Run queue tests and mobile typecheck**

Run: `cd apps/mobile && npx tsx --test src/lib/walk-track-point-queue.test.ts && npx tsc --noEmit`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): sample TrackPoints every 10s with pin and path"
```

---

### Task 7: iOS E2E evidence

**Files:**
- Create: `docs/logs/20260817001133-r1-step4-track-point/screenshots/ios-walk-recording-map.png`
- Create: `docs/logs/20260817001133-r1-step4-track-point/screenshots/ios-walk-recording-path.png`
- Create: `docs/logs/20260817001133-r1-step4-track-point/screenshots/ios-walk-recording-background-return.png`
- Create: `docs/logs/20260817001133-r1-step4-track-point/e2e-report.md`

**Interfaces:**
- Consumes: Compose（Postgres + ElasticMQ + DynamoDB Local + API + worker）、migration 0006 適用済み、Cognito OTP、iPhone simulator development client
- Produces: 地図背景、ピン、経路、Background 復帰の PNG とレポート

`recording-ios-e2e-evidence` に従う。成功証跡は Recording の地図・ピン・経路。回復証跡は Background から戻ったあとも地図・ピン・経路がある画面。入力エラー専用画面は TrackPoint に無いので、Ready の位置情報不足メッセージは撮らない（この縦切りの対象外）。retryable 失敗の専用 UI も無いので、Recording のままであることがレポート本文で足りる。

- [ ] **Step 1: Confirm AWS SSO before Verify**

Run: `aws sts get-caller-identity --profile walk-dog`

失敗したら `aws sso login --profile walk-dog` を出して停止する。

- [ ] **Step 2: Boot dependencies and API**

`apps` で Compose を上げ、`apps/api` で `npm run migrate`。API と worker が動き、`GET /health` が 200 であること。モバイルは development client。`expo-task-manager` を入れたので native rebuild が必要なら作り直してから撮る。

- [ ] **Step 3: Capture required states**

Sign In → Walk → Start → Recording。10秒以上待ってピンと経路。Home へ送ってからアプリに戻り、地図・ピン・経路が残っていること。

- [ ] **Step 4: Write e2e-report.md**

実行環境、コマンド、`POST /v1/walks/:walkId/track-points` 201、`GET /health` 200、各 PNG を記載する。

- [ ] **Step 5: Commit**

```bash
git add docs/logs/20260817001133-r1-step4-track-point/screenshots \
  docs/logs/20260817001133-r1-step4-track-point/e2e-report.md
git commit -m "docs: record TrackPoint iOS evidence"
```

---

## Self-review

1. **Spec coverage:** POST 201 / replay / conflict / 400 / 401 / 404 / 409、SQS 受理、worker DynamoDB 1 件、health 200/503、Compose、10秒・ピン・経路・Background・自動再送、iOS 証跡 → Tasks 1–7。Finish 確定待ち、Event、Walk Detail、S3 は含めない。
2. **Placeholders:** なし。
3. **Type consistency:** `TrackPoint`、`AcceptTrackPoint`、`TrackPointQueue.enqueue`、`ConfirmTrackPoint.confirm`、`LocalTrackPoint` を全 Task で同じ名前にする。route path は `/{walkId}/track-points`。
