# R1 Step 5 Finish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Finish が端末キュー吐き出し後、受理済み TrackPoint の DynamoDB 確定を最大 30秒待ってから Completed を返し、揃わなければ 503 で Recording + Retry にする。

**Architecture:** `finishWalk` が PG 受理 `recordedAt` を読み、`ConfirmedTrackPoints` で DynamoDB `Query(walkId)` をポーリングし、集合が揃ってから `WalkRepository.finish` する。0件は待ちなし。モバイルは flush → POST finish のまま、503 の `message` で Retry 表示する。

**Tech Stack:** Hono、`@hono/zod-openapi`、Zod 4、Drizzle、AWS SDK v3 DynamoDB (`QueryCommand`)、Node.js test runner、Expo

**Spec:** `docs/logs/20260906122123-r1-step5-finish/design.md`、`finish-api-spec.html`、`finish-spec-mockups.html`

## Global Constraints

- 公開契約は `finish-api-spec.html` と `finish-spec-mockups.html` に従う。
- `POST /v1/walks/:walkId/finish` 成功は 200 Completed。body は `{}`。`Idempotency-Key` 必須。
- Completed の `distanceMeters` は `0`、`paceSecondsPerMeter` は `null`。
- 確定待ち上限は 30秒。ポーリング間隔は実装ローカル（200ms）。
- TrackPoint 0件は待ちなしで Completed。
- 確定待ち失敗は 503 `SERVICE_UNAVAILABLE`、message「終了処理を完了できませんでした。もう一度お試しください。」、`retryable: true`。Walk は `recording` のまま。
- Walk の中間状態は作らない。確定完了まで `recording`。
- use case は Hono / Zod / AWS SDK / Drizzle を import しない。
- collaborator は required 注入。Quiet no-op を production factory に埋め込まない。
- モバイル HTTP は `lib/walk-api.ts`。画面は `apiRequest` を直接呼ばない。
- コマンドは指定がなければ `apps/api` または `apps/mobile` から実行する。
- 各 Task は targeted test → 関連 gate → commit。

## File map

| File | Responsibility |
| --- | --- |
| `apps/api/src/modules/walks/provider.ts` | `ConfirmedTrackPoints` ポート |
| `apps/api/src/modules/walks/repository.ts` | `listAcceptedRecordedAt` |
| `apps/api/src/modules/walks/types.ts` | `FinishWalk` に `service_unavailable` |
| `apps/api/src/modules/walks/use-cases/finish-walk.ts` | 待ち → finish |
| `apps/api/src/infrastructure/dynamodb/list-confirmed-recorded-at.ts` | DynamoDB Query adapter |
| `apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts` | 受理 `recordedAt` 一覧 |
| `apps/api/src/modules/walks/routes/finish-walk.ts` | 503 応答 |
| `apps/api/src/infrastructure/config/index.ts` | finish 待ち上限 30秒 |
| `apps/api/src/index.ts` | wiring |
| `apps/mobile/src/app/(app)/(tabs)/walk.tsx` | Finish 失敗で API `message` を表示 |

## Shared types (all tasks)

```ts
export type ConfirmedTrackPoints = {
  listRecordedAt(walkId: string): Promise<Date[]>
}

export type FinishWalkClock = {
  now(): number
}

export type FinishWalkSleep = {
  sleep(ms: number): Promise<void>
}

export type FinishWalk = (input: {
  cognitoSubject: string
  walkId: string
  idempotencyKey: string
}) => Promise<
  | { ok: true; walk: CompletedWalk }
  | {
      ok: false
      error:
        | 'not_found'
        | 'walk_not_recording'
        | 'idempotency_conflict'
        | 'service_unavailable'
    }
>
```

`createFinishWalk(owners, walks, confirmed, clock, sleep, timeoutMs)` — すべて required。

照合: 受理 `recordedAt` の各値（`toISOString()`）が DynamoDB 側集合に含まれる。

---

### Task 1: listAcceptedRecordedAt on WalkRepository

**Files:**
- Modify: `apps/api/src/modules/walks/repository.ts`
- Modify: `apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts`
- Modify: `apps/api/test/infrastructure/database/drizzle-walk-repository.test.ts`
- Modify: every `WalkRepository` fake in `apps/api/test/**` that constructs the full interface

**Interfaces:**
- Consumes: existing `walk_track_points` / `walks` tables
- Produces: `WalkRepository.listAcceptedRecordedAt(input: { ownerId: string; walkId: string }): Promise<Date[]>`
  - Walk 欠如 / 別 Owner → `WalkNotFoundError`
  - `recording` ではない → `WalkNotRecordingError`
  - 成功 → その Walk の受理 `recordedAt` を昇順で返す（0件可）

- [x] **Step 1: Write failing repository tests**

```ts
test('listAcceptedRecordedAt returns recordedAt values for a recording walk', async () => {
  // seed recording walk + two walk_track_points
  // assert dates equal inserted recordedAt, ascending
})

test('listAcceptedRecordedAt returns empty array when there are no points', async () => {
  // seed recording walk only
})

test('listAcceptedRecordedAt throws WalkNotFoundError for another owner', async () => {
  // ...
})

test('listAcceptedRecordedAt throws WalkNotRecordingError when completed', async () => {
  // ...
})
```

- [x] **Step 2: Run tests — expect FAIL**

Run: `cd apps/api && node --test test/infrastructure/database/drizzle-walk-repository.test.ts`

- [x] **Step 3: Implement `listAcceptedRecordedAt`**

Select walk by `walkId`; check `ownerId` and `state === 'recording'`; select `recordedAt` from `walk_track_points` ordered ascending.

- [x] **Step 4: Fix all WalkRepository fakes**

Add `listAcceptedRecordedAt` that throws `unexpected` unless the test overrides it.

- [x] **Step 5: Run tests — expect PASS**

Run: `cd apps/api && node --test test/infrastructure/database/drizzle-walk-repository.test.ts`

- [x] **Step 6: Commit**

```bash
git add apps/api/src/modules/walks/repository.ts \
  apps/api/src/infrastructure/database/repositories/drizzle-walk-repository.ts \
  apps/api/test
git commit -m "$(cat <<'EOF'
feat(api): list accepted TrackPoint times for finish confirmation

EOF
)"
```

---

### Task 2: ConfirmedTrackPoints DynamoDB adapter

**Files:**
- Modify: `apps/api/src/modules/walks/provider.ts`
- Create: `apps/api/src/infrastructure/dynamodb/list-confirmed-recorded-at.ts`
- Create: `apps/api/test/infrastructure/dynamodb/list-confirmed-recorded-at.test.ts`

**Interfaces:**
- Consumes: `DynamoDbConfig`, DynamoDB client `send`
- Produces: `createListConfirmedRecordedAt(client, config): ConfirmedTrackPoints`
  - `listRecordedAt(walkId)` → `Query` on `walkId` HASH, collect `recordedAt` S attributes as `Date[]`

- [x] **Step 1: Write failing adapter test with fake sender**

```ts
test('listRecordedAt queries by walkId and returns recordedAt dates', async () => {
  const sends: unknown[] = []
  const client = {
    async send(command: unknown) {
      sends.push(command)
      return {
        Items: [
          { walkId: { S: walkId }, recordedAt: { S: '2026-09-06T03:12:14.000Z' } },
        ],
      }
    },
  }
  const confirmed = createListConfirmedRecordedAt(client, config)
  assert.deepEqual(await confirmed.listRecordedAt(walkId), [
    new Date('2026-09-06T03:12:14.000Z'),
  ])
  // assert QueryCommand TableName / KeyConditionExpression
})

test('listRecordedAt returns empty array when no items', async () => {
  // Items undefined or []
})
```

- [x] **Step 2: Run test — expect FAIL**

Run: `cd apps/api && node --test test/infrastructure/dynamodb/list-confirmed-recorded-at.test.ts`

- [x] **Step 3: Implement adapter + export type from provider**

```ts
export type ConfirmedTrackPoints = {
  listRecordedAt(walkId: string): Promise<Date[]>
}
```

Use `QueryCommand` with `KeyConditionExpression: 'walkId = :walkId'`. Paginate with `ExclusiveStartKey` while `LastEvaluatedKey` is present.

- [x] **Step 4: Run test — expect PASS**

- [x] **Step 5: Commit**

```bash
git add apps/api/src/modules/walks/provider.ts \
  apps/api/src/infrastructure/dynamodb/list-confirmed-recorded-at.ts \
  apps/api/test/infrastructure/dynamodb/list-confirmed-recorded-at.test.ts
git commit -m "$(cat <<'EOF'
feat(api): query confirmed TrackPoint times from DynamoDB

EOF
)"
```

---

### Task 3: finishWalk waits for confirmation

**Files:**
- Modify: `apps/api/src/modules/walks/types.ts`
- Modify: `apps/api/src/modules/walks/use-cases/finish-walk.ts`
- Modify: `apps/api/test/modules/walks/use-cases/finish-walk.test.ts`

**Interfaces:**
- Consumes: `OwnerRepository`, `WalkRepository` (incl. `listAcceptedRecordedAt`), `ConfirmedTrackPoints`, `FinishWalkClock`, `FinishWalkSleep`, `timeoutMs: number`
- Produces: updated `createFinishWalk(...)` and `FinishWalk` error union including `service_unavailable`

- [x] **Step 1: Rewrite finish-walk tests for required collaborators**

```ts
function createSut(opts: {
  listAccepted?: WalkRepository['listAcceptedRecordedAt']
  finish?: WalkRepository['finish']
  listConfirmed?: ConfirmedTrackPoints['listRecordedAt']
  nowValues?: number[]
  sleepCalls?: number[]
}) {
  // clock.now pops from nowValues (default [0, 0, ...])
  // sleep records ms and resolves
  // timeoutMs = 30_000
}

test('finishWalk completes immediately when there are no accepted points', async () => {
  // listAccepted → []
  // confirmed never called
  // finish called once → ok walk
})

test('finishWalk finishes after confirmed set covers accepted recordedAt', async () => {
  // accepted [t1]
  // confirmed: first [] then [t1]
  // sleep called once with 200
  // finish called once
})

test('finishWalk returns service_unavailable when timeout elapses before confirmation', async () => {
  // accepted [t1]
  // confirmed always []
  // now: 0 then 30_001
  // finish never called
  // result service_unavailable
})

test('finishWalk returns not_found when listAcceptedRecordedAt throws WalkNotFoundError', async () => {
  // ...
})

test('finishWalk returns walk_not_recording when listAcceptedRecordedAt throws WalkNotRecordingError', async () => {
  // ...
})

// keep existing finish-error mapping tests, with empty accepted list so wait is skipped
```

- [x] **Step 2: Run tests — expect FAIL**

Run: `cd apps/api && node --test test/modules/walks/use-cases/finish-walk.test.ts`

- [x] **Step 3: Implement wait loop**

```ts
export function createFinishWalk(
  owners: OwnerRepository,
  walks: WalkRepository,
  confirmed: ConfirmedTrackPoints,
  clock: FinishWalkClock,
  sleep: FinishWalkSleep,
  timeoutMs: number,
): FinishWalk {
  return async (input) => {
    const owner = await owners.resolveByCognitoSubject(input.cognitoSubject)
    const bodyHash = createHash('sha256').update('{}').digest('hex')
    try {
      const accepted = await walks.listAcceptedRecordedAt({
        ownerId: owner.ownerId,
        walkId: input.walkId,
      })
      if (accepted.length > 0) {
        const deadline = clock.now() + timeoutMs
        const needed = new Set(accepted.map((d) => d.toISOString()))
        for (;;) {
          const confirmedAt = await confirmed.listRecordedAt(input.walkId)
          const have = new Set(confirmedAt.map((d) => d.toISOString()))
          if ([...needed].every((key) => have.has(key))) {
            break
          }
          if (clock.now() >= deadline) {
            return { ok: false, error: 'service_unavailable' }
          }
          await sleep.sleep(200)
        }
      }
      const walk = await walks.finish({
        ownerId: owner.ownerId,
        walkId: input.walkId,
        idempotencyKey: input.idempotencyKey,
        bodyHash,
      })
      return { ok: true, walk }
    } catch (error) {
      // map WalkNotFoundError / WalkNotRecordingError / IdempotencyConflictError
    }
  }
}
```

- [x] **Step 4: Run tests — expect PASS**

- [x] **Step 5: Commit**

```bash
git add apps/api/src/modules/walks/types.ts \
  apps/api/src/modules/walks/use-cases/finish-walk.ts \
  apps/api/test/modules/walks/use-cases/finish-walk.test.ts
git commit -m "$(cat <<'EOF'
feat(api): wait for DynamoDB TrackPoint confirmation before finish

EOF
)"
```

---

### Task 4: Route 503 + OpenAPI + wiring

**Files:**
- Modify: `apps/api/src/modules/walks/routes/finish-walk.ts`
- Modify: `apps/api/test/modules/walks/routes/finish-walk.test.ts`
- Modify: `apps/api/test/openapi.test.ts`
- Modify: `apps/api/src/infrastructure/config/index.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/.env.example` (and compose env if finish timeout is env-driven)
- Modify: `apps/api/README.md` — Finish が DynamoDB 確定を最大 30秒待つ旨

**Interfaces:**
- Consumes: Task 3 `FinishWalk`
- Produces: 503 envelope; `createFinishWalk(..., createListConfirmedRecordedAt(...), { now: () => Date.now() }, { sleep: (ms) => new Promise(r => setTimeout(r, ms)) }, 30_000)`

- [x] **Step 1: Write failing route test for 503**

```ts
test('POST /v1/walks/:walkId/finish returns 503 SERVICE_UNAVAILABLE when confirmation times out', async () => {
  const response = await createFinishWalkApp(async () => ({
    ok: false,
    error: 'service_unavailable',
  })).request(`/v1/walks/${walkId}/finish`, {
    method: 'POST',
    headers: authorizedHeaders,
    body: '{}',
  })
  const body = await response.json()
  assert.equal(response.status, 503)
  assert.equal(body.code, 'SERVICE_UNAVAILABLE')
  assert.equal(body.message, '終了処理を完了できませんでした。もう一度お試しください。')
  assert.equal(body.retryable, true)
})
```

Update `openapi.test.ts` expected statuses to include `'503'`.

- [x] **Step 2: Run tests — expect FAIL**

Run: `cd apps/api && node --test test/modules/walks/routes/finish-walk.test.ts test/openapi.test.ts`

- [x] **Step 3: Add 503 to route responses and handler branch; wire collaborators in `index.ts`**

Timeout constant: `30_000` (or `loadFinishConfig(env).confirmationTimeoutMs` with default 30000). Prefer a named constant or config load that fails closed if invalid — required wiring, no quiet default inside the use case.

Update every test/app factory that calls `createFinishWalk` to pass the new required args.

- [x] **Step 4: Run full API tests — expect PASS**

Run: `cd apps/api && npm test`

- [x] **Step 5: Commit**

```bash
git add apps/api
git commit -m "$(cat <<'EOF'
feat(api): return 503 when finish confirmation wait times out

EOF
)"
```

---

### Task 5: Mobile Finish Retry shows API message

**Files:**
- Modify: `apps/mobile/src/app/(app)/(tabs)/walk.tsx`
- Create or modify: `apps/mobile/src/app/(app)/(tabs)/walk-finish.test.ts` (or existing walk test if present — prefer a small unit around finish error copy if extracting is heavy; otherwise extend coordinator-style test). If no existing screen test harness, add a focused test for a tiny helper:

```ts
// apps/mobile/src/lib/walk-finish-error-message.ts
export function walkFinishErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return '終了に失敗しました。再試行してください。'
}
```

- Modify: `apps/mobile/README.md` — Finish waits on API for DynamoDB confirmation; 503 keeps Recording + Retry

**Interfaces:**
- Consumes: `ApiError` from `lib/api.ts`
- Produces: Finish 失敗表示が 503 message「終了処理を完了できませんでした。もう一度お試しください。」を出す

- [x] **Step 1: Write failing test for message helper**

```ts
test('walkFinishErrorMessage uses ApiError message', () => {
  assert.equal(
    walkFinishErrorMessage(new ApiError({
      code: 'SERVICE_UNAVAILABLE',
      message: '終了処理を完了できませんでした。もう一度お試しください。',
      requestId: 'r1',
      retryable: true,
      status: 503,
    })),
    '終了処理を完了できませんでした。もう一度お試しください。',
  )
})
```

- [x] **Step 2: Implement helper + wire `onFinish` catch / `finishError` state to store the message string**

Change recording state from `finishError: boolean` to `finishErrorMessage: string | null` (or keep boolean and add message field). Display that string in the Recording Finish error `Text`.

- [x] **Step 3: Run mobile tests + tsc**

Run: `cd apps/mobile && npm test && npx tsc --noEmit`

- [x] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "$(cat <<'EOF'
feat(mobile): show finish API error message on retry

EOF
)"
```

---

### Task 6: Session verification gate

**Files:** none required beyond fixes

- [x] **Step 1: Run API full suite**

Run: `cd apps/api && npm test`  
Expected: pass

- [x] **Step 2: Run mobile suite + tsc**

Run: `cd apps/mobile && npm test && npx tsc --noEmit`  
Expected: pass

- [x] **Step 3: Update session transcript artifact list / completion note**

- [x] **Step 4: Commit docs if any leftover session log updates on the branch**

```bash
git add docs/logs/20260906122123-r1-step5-finish docs/development/staged-development.md
git commit -m "$(cat <<'EOF'
docs: record R1 step 5 Finish design and plan

EOF
)"
```

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| flush then POST finish (mobile already) | 5 (message only) |
| wait until PG accepted ⊆ DynamoDB | 1–3 |
| 0件即完了 | 3 |
| 30秒で 503 / recording 維持 | 3–4 |
| OpenAPI 503 | 4 |
| Retry UI + API message | 5 |
| distance 0 unchanged | no change |
| worker 重複でも揃うまで待つ | 3 (set coverage) |

## Self-review

- No TBD placeholders.
- `createFinishWalk` arity changes are listed in Tasks 3–4 for all call sites.
- Poll interval fixed at 200ms in use case (implementation-local).
- Pagination on DynamoDB Query included in Task 2.
