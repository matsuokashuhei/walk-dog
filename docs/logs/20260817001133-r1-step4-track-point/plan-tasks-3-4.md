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

