# R1 Step 6 Event + Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Recording 中に Participant 別 Event（冪等 Retry）を記録し、Finish で DynamoDB 経路長を Walk に保存し、Walk Detail で経路・距離・時間・Event を表示する。

**Architecture:** Event / Detail / 距離は既存 `walks` モジュールに追加する。`recordEvent` は PostgreSQL `walk_events` へ冪等保存する。`finishWalk` は確定待ち後に DynamoDB 点列から `pathDistanceMeters` を算出し `walks.distance_meters` へ保存する。`getWalkDetail` は保存距離 + DynamoDB 経路 + Event 一覧を返す。モバイルは TrackPoint とは別の `walk-event-queue` で手動 Retry し、Recording 距離は端末 path から表示する。

**Tech Stack:** Hono、`@hono/zod-openapi`、Zod 4、Drizzle、AWS SDK v3 DynamoDB、Node.js test runner、Expo Router

**Spec:** `docs/logs/20260906142148-r1-step6-event-detail/design.md`、`event-api-spec.html`、`event-spec-mockups.html`

## Global Constraints

- 公開契約は `event-api-spec.html` と `event-spec-mockups.html` に従う。
- Event `type` は `pee` / `poop` / `sniff` / `greet`。`eventId` はモバイル生成 UUID。
- Retry は同じ `eventId`・種別・Participant・`occurredAt`・位置。同一内容は 200、内容違いは 409。
- Recording 距離・pace は端末 TrackPoint。Finish / Detail の距離は DynamoDB 確定経路。距離は整数メートル。距離 0 のとき `paceSecondsPerMeter` は `null`。
- Finish 成功時に `distanceMeters` を Walk 行へ保存する。Detail はその保存値を返す。
- Event 未送信は Finish 成功条件に含めない。
- 履歴一覧 `GET /walks`・Photo・実機ライフサイクル検証は含めない。
- use case は Hono / Zod / AWS SDK / Drizzle を import しない。
- collaborator は required 注入。Quiet no-op を production factory に埋め込まない。
- モバイル HTTP は `lib/walk-api.ts`。画面は `apiRequest` を直接呼ばない。
- コマンドは指定がなければ `apps/api` または `apps/mobile` から実行する。
- 各 Task は targeted test → 関連 gate → commit。
- Worktree: `.worktrees/agent/r1-step6-event-detail-20260906142148`。ブランチ: `agent/r1-step6-event-detail-20260906142148`。

## File map

| File | Responsibility |
| --- | --- |
| `apps/api/src/infrastructure/database/schema/walk.ts` | `distanceMeters` 列 |
| `apps/api/src/infrastructure/database/schema/walk-event.ts` | `walk_events` テーブル |
| `apps/api/drizzle/0007_*` / `0008_*` | migration SQL |
| `apps/api/src/modules/walks/path-distance.ts` | `pathDistanceMeters` 純関数 |
| `apps/api/src/modules/walks/types.ts` | Event / Detail / CompletedWalk 距離型 |
| `apps/api/src/modules/walks/repository.ts` | `recordEvent` / `getCompletedDetail` / `finish` に距離 |
| `apps/api/src/modules/walks/provider.ts` | `ConfirmedTrackPoints.listPoints` |
| `apps/api/src/modules/walks/use-cases/record-event.ts` | Event 受理 |
| `apps/api/src/modules/walks/use-cases/get-walk-detail.ts` | Detail 合成 |
| `apps/api/src/modules/walks/use-cases/finish-walk.ts` | 距離算出・保存 |
| `apps/api/src/modules/walks/routes/record-event.ts` | `POST .../events` |
| `apps/api/src/modules/walks/routes/get-walk-detail.ts` | `GET .../:walkId` |
| `apps/api/src/infrastructure/dynamodb/list-confirmed-recorded-at.ts` | lat/lng 付き点列 |
| `apps/mobile/src/lib/walk-event-queue.ts` | Event 永続キュー |
| `apps/mobile/src/lib/walk-api.ts` | `postEvent` / `getWalkDetail`、Completed 距離型 |
| `apps/mobile/src/app/(app)/(tabs)/walk.tsx` | Event UI・距離・Detail 導線 |
| `apps/mobile/src/app/(app)/walks/[walkId].tsx` | Walk Detail 画面 |

## Shared types (all tasks)

```ts
export type EventType = 'pee' | 'poop' | 'sniff' | 'greet'

export type WalkEvent = {
  eventId: string
  walkId: string
  participantDogId: string
  type: EventType
  occurredAt: Date
  latitude: number
  longitude: number
}

export type RecordEventInput = {
  ownerId: string
  walkId: string
  eventId: string
  participantDogId: string
  type: EventType
  occurredAt: Date
  latitude: number
  longitude: number
}

export type ConfirmedTrackPoint = {
  recordedAt: Date
  latitude: number
  longitude: number
}

export type ConfirmedTrackPoints = {
  listRecordedAt(walkId: string): Promise<Date[]>
  listPoints(walkId: string): Promise<ConfirmedTrackPoint[]>
}

export type CompletedWalk = {
  walkId: string
  ownerId: string
  state: 'completed'
  startedAt: Date
  completedAt: Date
  durationSeconds: number
  distanceMeters: number
  paceSecondsPerMeter: number | null
  participants: WalkParticipant[]
}

export type WalkDetail = CompletedWalk & {
  trackPoints: ConfirmedTrackPoint[]
  events: WalkEvent[]
}

export type FinishWalkInput = {
  ownerId: string
  walkId: string
  idempotencyKey: string
  bodyHash: string
  distanceMeters: number
}

export function pathDistanceMeters(
  points: ReadonlyArray<{ latitude: number; longitude: number }>,
): number

export function paceSecondsPerMeter(
  durationSeconds: number,
  distanceMeters: number,
): number | null
// distanceMeters <= 0 → null、それ以外 → durationSeconds / distanceMeters
```

照合（Event 冪等）: 同一 `eventId` で `participantDogId` / `type` / `occurredAt` / `latitude` / `longitude` がすべて一致すれば replay。いずれか違えば `IdempotencyConflictError`。

---

### Task 1: Schema + migration（Event と distance_meters）

**Files:**
- Create: `apps/api/src/infrastructure/database/schema/walk-event.ts`
- Modify: `apps/api/src/infrastructure/database/schema/walk.ts`
- Create: `apps/api/drizzle/0007_add_distance_meters_to_walks.sql`（generate 後に整理）
- Create: `apps/api/drizzle/0008_create_walk_events.sql`（generate 後に整理）
- Modify: `apps/api/drizzle/meta/*`（journal / snapshots）

**Interfaces:**
- Consumes: existing `walks` / `dogs` FKs
- Produces: `walks.distance_meters integer`（nullable、recording は null、completed は 0 以上）。`walk_events` テーブル（`event_id` PK、`walk_id` FK、`participant_dog_id`、`type` enum、`occurred_at`、`latitude`、`longitude`、`created_at`）

- [x] **Step 1: Update TypeScript schemas**

`walk.ts` に `distanceMeters: integer('distance_meters')`（nullable）を追加。

`walk-event.ts`:

```ts
export const walkEventTypeEnum = pgEnum('walk_event_type', ['pee', 'poop', 'sniff', 'greet'])

export const walkEvents = pgTable('walk_events', {
  eventId: uuid('event_id').primaryKey(), // client-provided
  walkId: uuid('walk_id').notNull().references(() => walks.walkId),
  participantDogId: uuid('participant_dog_id').notNull().references(() => dogs.dogId),
  type: walkEventTypeEnum('type').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  latitude: numeric('latitude', { precision: 8, scale: 6, mode: 'number' }).notNull(),
  longitude: numeric('longitude', { precision: 9, scale: 6, mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

緯度経度の precision は `walk-track-point.ts` と同じ。

- [x] **Step 2: Generate migration**

Run: `cd apps/api && npm run db:generate -- --name=walk_events_and_distance`

- [x] **Step 3: Review and split SQL**

`migrating-drizzle-postgres` に従い、1ファイル 1 `CREATE TABLE`。`ALTER TABLE walks ADD distance_meters` は別ファイル（例: `0007_add_distance_meters_to_walks.sql`）、`CREATE TABLE walk_events` は `0008_create_walk_events.sql`。journal / snapshot を整合させる。

- [x] **Step 4: Apply migration locally**

Run: `cd apps/api && npm run migrate`（compose Postgres が起動していること）

- [x] **Step 5: Commit**

```bash
git add apps/api/src/infrastructure/database/schema apps/api/drizzle
git commit -m "$(cat <<'EOF'
feat(api): add walk_events and walk distance_meters schema

EOF
)"
```

---

### Task 2: pathDistanceMeters + pace helpers

**Files:**
- Create: `apps/api/src/modules/walks/path-distance.ts`
- Create: `apps/api/test/modules/walks/path-distance.test.ts`
- Create: `apps/mobile/src/lib/path-distance.ts`（同ロジック。API と数値一致させる）
- Create: `apps/mobile/src/lib/path-distance.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `pathDistanceMeters`、`paceSecondsPerMeter`（上記 Shared types）

- [x] **Step 1: Write failing API tests**

```ts
test('pathDistanceMeters returns 0 for fewer than 2 points', () => {
  assert.equal(pathDistanceMeters([]), 0)
  assert.equal(pathDistanceMeters([{ latitude: 35, longitude: 139 }]), 0)
})

test('pathDistanceMeters sums haversine segments as integer meters', () => {
  // two points ~111m apart on meridian → assert nearby integer (document expected)
  const meters = pathDistanceMeters([
    { latitude: 35.0, longitude: 139.0 },
    { latitude: 35.001, longitude: 139.0 },
  ])
  assert.equal(meters, /* computed expected integer */)
})

test('paceSecondsPerMeter is null when distance is 0', () => {
  assert.equal(paceSecondsPerMeter(100, 0), null)
})

test('paceSecondsPerMeter divides duration by distance', () => {
  assert.equal(paceSecondsPerMeter(1920, 2100), 1920 / 2100)
})
```

- [x] **Step 2: Run — expect FAIL**

Run: `cd apps/api && node --test test/modules/walks/path-distance.test.ts`

- [x] **Step 3: Implement haversine sum + Math.round**

Earth radius 6371000m。連続点の距離を合計し `Math.round`。

- [x] **Step 4: Mirror on mobile with identical tests/expected values**

Run: `cd apps/mobile && npm test -- src/lib/path-distance.test.ts`

- [x] **Step 5: Commit**

```bash
git add apps/api/src/modules/walks/path-distance.ts \
  apps/api/test/modules/walks/path-distance.test.ts \
  apps/mobile/src/lib/path-distance.ts \
  apps/mobile/src/lib/path-distance.test.ts
git commit -m "$(cat <<'EOF'
feat: add path distance and pace helpers

EOF
)"
```

---

### Task 3: recordEvent on WalkRepository + use case

**Files:**
- Modify: `apps/api/src/modules/walks/types.ts`
- Modify: `apps/api/src/modules/walks/repository.ts`
- Modify: `apps/api/src/modules/walks/errors.ts`（必要なら）
- Modify: `apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts`
- Create: `apps/api/src/modules/walks/use-cases/record-event.ts`
- Create: `apps/api/test/modules/walks/use-cases/record-event.test.ts`
- Create: `apps/api/test/infrastructure/database/drizzle-walk-repository-record-event.test.ts`
- Modify: every `WalkRepository` fake in `apps/api/test/**`

**Interfaces:**
- Consumes: `walk_events`、participants、recording walk
- Produces:
  - `WalkRepository.recordEvent(input: RecordEventInput): Promise<{ event: WalkEvent; created: boolean }>`
    - Walk 欠如 / 別 Owner → `WalkNotFoundError`
    - not recording → `WalkNotRecordingError`
    - participant がその Walk にいない → `WalkNotFoundError`
    - 同一 eventId・同一内容 → `{ event, created: false }`
    - 同一 eventId・内容違い → `IdempotencyConflictError`
    - 新規 → insert → `{ event, created: true }`
  - `RecordEvent` use case → `{ ok: true, event, created }` or `{ ok: false, error }`

- [x] **Step 1: Write failing repository + use case tests**

Cover: create、replay 200 path (`created: false`)、conflict、not recording、non-participant、other owner。

- [x] **Step 2: Run — expect FAIL**

Run: `cd apps/api && node --test test/infrastructure/database/drizzle-walk-repository-record-event.test.ts test/modules/walks/use-cases/record-event.test.ts`

- [x] **Step 3: Implement repository + `createRecordEvent(owners, walks)`**

- [x] **Step 4: Fix all WalkRepository fakes**

- [x] **Step 5: Run — expect PASS**

- [x] **Step 6: Commit**

```bash
git add apps/api/src/modules/walks apps/api/src/infrastructure/database/repositories apps/api/test
git commit -m "$(cat <<'EOF'
feat(api): record walk events with eventId idempotency

EOF
)"
```

---

### Task 4: POST /v1/walks/:walkId/events route + OpenAPI

**Files:**
- Modify: `apps/api/src/modules/walks/contracts.ts`
- Create: `apps/api/src/modules/walks/routes/record-event.ts`
- Modify: `apps/api/src/modules/walks/routes/index.ts`
- Modify: `apps/api/src/index.ts` / wiring（`finish-walk-wiring` や application factory に `recordEvent` を追加）
- Create: `apps/api/test/modules/walks/routes/record-event.test.ts`
- Modify: `apps/api/test/openapi.test.ts`

**Interfaces:**
- Consumes: `RecordEvent`
- Produces: OpenAPI `POST /v1/walks/{walkId}/events`
  - 201 created / 200 replay
  - 400 / 401 / 404 / 409 envelopes per `event-api-spec.html`
  - 409 `WALK_NOT_RECORDING` message「この散歩には記録できません。」

- [x] **Step 1: Write failing route + openapi characterization tests**

- [x] **Step 2: Run — expect FAIL**

- [x] **Step 3: Implement contracts、route、register、wire**

- [x] **Step 4: Run route + openapi + related tests — expect PASS**

Run: `cd apps/api && node --test test/modules/walks/routes/record-event.test.ts test/openapi.test.ts`

- [x] **Step 5: Commit**

```bash
git add apps/api/src/modules/walks apps/api/src apps/api/test
git commit -m "$(cat <<'EOF'
feat(api): expose POST walk events endpoint

EOF
)"
```

---

### Task 5: Finish 距離保存（ConfirmedTrackPoints.listPoints）

**Files:**
- Modify: `apps/api/src/modules/walks/provider.ts`
- Modify: `apps/api/src/infrastructure/dynamodb/list-confirmed-recorded-at.ts`（または rename 相当の実装拡張）
- Modify: `apps/api/src/modules/walks/types.ts`（`CompletedWalk.distanceMeters: number`、`FinishWalkInput.distanceMeters`）
- Modify: `apps/api/src/modules/walks/contracts.ts`（`distanceMeters: z.number().int().nonnegative()`、`paceSecondsPerMeter: z.number().nullable()`）
- Modify: `apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts`（`finish` が距離を保存し pace を返す）
- Modify: `apps/api/src/modules/walks/use-cases/finish-walk.ts`
- Modify: finish / repository / route tests that assert `distanceMeters: 0` literal
- Create or modify: DynamoDB listPoints tests

**Interfaces:**
- Consumes: `pathDistanceMeters`、`ConfirmedTrackPoints.listPoints`
- Produces: Finish 200 の実距離。0件は 0 / pace `null`。`listRecordedAt` は `listPoints` の `recordedAt` 投影で互換維持可

- [x] **Step 1: Write failing tests**

```ts
test('finishWalk stores path distance from confirmed points', async () => {
  // accepted + confirmed two points → distanceMeters === pathDistanceMeters(points)
})

test('finishWalk with zero points returns distanceMeters 0 and null pace', async () => {
  // ...
})
```

Update existing finish tests: `distanceMeters` は number（0 可）、`z.literal(0)` を削除。

- [x] **Step 2: Run — expect FAIL**

- [x] **Step 3: Implement listPoints、finish(distanceMeters)、finishWalk 算出**

`finishWalk` 確定後:

```ts
const points = accepted.length === 0 ? [] : await confirmed.listPoints(input.walkId)
const distanceMeters = pathDistanceMeters(points)
const walk = await walks.finish({ ..., distanceMeters })
```

- [x] **Step 4: Run finish / dynamodb / contract tests — expect PASS**

- [x] **Step 5: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "$(cat <<'EOF'
feat(api): persist finish distance from confirmed track points

EOF
)"
```

---

### Task 6: GET /v1/walks/:walkId Detail

**Files:**
- Modify: `apps/api/src/modules/walks/repository.ts` — `getCompletedByOwner` または detail 用メソッド
- Modify: `apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts`
- Create: `apps/api/src/modules/walks/use-cases/get-walk-detail.ts`
- Create: `apps/api/src/modules/walks/routes/get-walk-detail.ts`
- Modify: contracts / routes index / wiring
- Create: use case + route tests
- Modify: openapi test
- Modify: WalkRepository fakes

**Interfaces:**
- Consumes: PG completed walk + events、`ConfirmedTrackPoints.listPoints`
- Produces: `GetWalkDetail` → `{ ok: true, detail: WalkDetail }` | `{ ok: false, error: 'not_found' }`
  - completed 以外 / 別 Owner / 欠如 → not_found
  - `events` は `occurredAt` 昇順（0件は `[]`）
  - `trackPoints` は DynamoDB `recordedAt` 昇順

- [x] **Step 1: Write failing use case + route tests**（Event あり、Event 空、TrackPoint 0、404）

- [x] **Step 2: Run — expect FAIL**

- [x] **Step 3: Implement repository listEvents、getWalkDetail、route、wire**

- [x] **Step 4: Run — expect PASS**

- [x] **Step 5: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "$(cat <<'EOF'
feat(api): get completed walk detail with path and events

EOF
)"
```

---

### Task 7: Mobile Event queue + walk-api

**Files:**
- Create: `apps/mobile/src/lib/walk-event-schema.ts`
- Create: `apps/mobile/src/lib/walk-event-queue.ts`
- Create: `apps/mobile/src/lib/walk-event-queue.test.ts`
- Modify: `apps/mobile/src/lib/walk-api.ts`（`postEvent`、`getWalkDetail`、`CompletedWalkResponse.distanceMeters: number`）
- Modify: `apps/mobile/src/lib/walk-api.test.ts`
- Create: AsyncStorage（または既存 path-store と同パターン）の Event queue persistence helpers

**Interfaces:**
- Consumes: `apiRequest`、Event payload
- Produces:
  - `postEvent(accessToken, walkId, body) → WalkEventResponse`（201/200 を成功扱い）
  - `getWalkDetail(accessToken, walkId) → WalkDetailResponse`
  - `createEventCoordinator` — enqueue、手動 `retryFailed`、同一 payload 保持。自動再送ループは作らない（契約は手動 Retry）

- [x] **Step 1: Write failing queue + api tests**

```ts
test('retryable failure keeps the same event payload for manual retry', async () => {
  // post fails retryable → queue retains identical eventId/body
})

test('successful post removes the event from the failed set', async () => {
  // ...
})

test('postEvent sends eventId participantDogId type occurredAt lat lng', async () => {
  // ...
})
```

- [x] **Step 2: Run — expect FAIL**

Run: `cd apps/mobile && npm test -- src/lib/walk-event-queue.test.ts src/lib/walk-api.test.ts`

- [x] **Step 3: Implement schema、queue、api methods、update CompletedWalkResponse types**

- [x] **Step 4: Run mobile tests + tsc — expect PASS**

Run: `cd apps/mobile && npm test && ./node_modules/.bin/tsc --noEmit`

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/lib
git commit -m "$(cat <<'EOF'
feat(mobile): add event outbound queue and walk detail API

EOF
)"
```

---

### Task 8: Recording UI + Completed Detail 導線 + Walk Detail 画面

**Files:**
- Modify: `apps/mobile/src/app/(app)/(tabs)/walk.tsx`
- Create: `apps/mobile/src/app/(app)/walks/[walkId].tsx`
- Modify: app layout / stack 登録が必要なら `_layout.tsx`
- Modify or create: 小さな presentational helpers（testID 付き）が必要なら同ディレクトリ
- Test: 可能なロジックは lib 側。画面は E2E で担保（Task 9 前の手動確認メモ）

**Interfaces:**
- Consumes: path store、`pathDistanceMeters`、event queue、`getWalkDetail`
- Produces:
  - Recording: 時間・距離・pace、Participant 別 Pee/Poop/Sniff/Greet、失敗時「記録に失敗しました」+ Retry
  - Completed: Finish の距離・pace、「Walk Detail を見る」→ `/walks/[walkId]`
  - Detail: 経路・メトリクス・Event 一覧。空なら「記録された Event はありません」
  - testID: `walk-event-pee-<dogId>` 等、`walk-event-retry`、`walk-completed-detail`、`walk-detail`、`walk-detail-events-empty`

- [x] **Step 1: Wire Recording metrics from local path**

表示単位は既存アプリの慣例に合わせる（km 表示なら m→km）。pace は秒/メートルから UI 表示へ変換。

- [x] **Step 2: Wire Event actions + retry banner**

`onEventPress` で UUID `eventId`、`occurredAt=now`、現在地 lat/lng を固定して enqueue→post。失敗は手動 Retry のみ。

- [x] **Step 3: Completed → Detail navigation + Detail screen fetch**

- [x] **Step 4: Run mobile tests + tsc**

Run: `cd apps/mobile && npm test && ./node_modules/.bin/tsc --noEmit`

- [x] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "$(cat <<'EOF'
feat(mobile): show events, live distance, and walk detail

EOF
)"
```

---

### Task 9: Session verification gate

**Files:** session docs only as needed

- [x] **Step 1: Run API full suite**

Run: `cd apps/api && npm test`  
Expected: pass

- [x] **Step 2: Run mobile suite + tsc**

Run: `cd apps/mobile && npm test && ./node_modules/.bin/tsc --noEmit`  
Expected: pass

- [x] **Step 3: Update transcript completion note + artifact list（`plan.md` checkboxes）

- [x] **Step 4: Commit docs**

```bash
git add docs/logs/20260906142148-r1-step6-event-detail docs/development/staged-development.md
git commit -m "$(cat <<'EOF'
docs: record R1 step 6 event detail plan and session state

EOF
)"
```

---

## Spec coverage self-check

| Spec requirement | Task |
| --- | --- |
| Event schema / migration | 1 |
| path distance / pace | 2 |
| recordEvent 冪等 | 3–4 |
| Finish 距離保存 | 5 |
| GET Walk Detail | 6 |
| Event 別キュー + API client | 7 |
| Recording UI / Completed / Detail | 8 |
| 全ゲート | 9 |
| 履歴一覧 / Photo / 縦切り 7 | 含めない（Deferred） |

## Execution handoff

Plan complete and saved to `docs/logs/20260906142148-r1-step6-event-detail/plan.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — タスクごとに新規サブエージェント、タスク間レビュー
2. **Inline Execution** — このセッションで `executing-plans` により逐次実行

どちらで進めますか？
