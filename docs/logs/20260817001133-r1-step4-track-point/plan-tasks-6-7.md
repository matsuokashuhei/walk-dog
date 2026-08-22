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
