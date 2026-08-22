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

