# Active Walk 設計

> WHAT → HOW → WHY

## WHAT

R1 Step 3 の Active Walk を API とモバイルで提供する。Owner は Dog を選んで散歩を開始し、Ready → Starting → Recording → Completed / Failed を API と同期して見る。

| 提供 | 内容 |
| --- | --- |
| Active 照会 | `GET /v1/walks/active` → その Owner の `recording`。無ければ 204 |
| 開始 | `POST /v1/walks` `{ participantDogIds }` + `Idempotency-Key` → `recording` |
| Finish | `POST /v1/walks/:walkId/finish` `{}` + `Idempotency-Key` → Completed。距離 0 |
| Walk 画面 | `/(tabs)/walk`。Ready / Starting / Recording / Completed / Failed |
| タブ | 認証済みシェルは Dogs と Walk |
| 地図 | 位置情報許可時は Apple MapKit を背景にし、現在地を表示する |

受け入れ:

- 有効 token の GET active は Active Walk があるとき 200、無いとき 204
- 有効 token と同一 Owner の Dog 1頭以上の POST は 201 と `recording`
- 有効 token の Finish は 200 Completed。`durationSeconds` は `startedAt` から `completedAt`。`distanceMeters` は 0。`paceSecondsPerMeter` は `null`
- token 欠如または不正は 401 `UNAUTHENTICATED`
- `participantDogIds` 欠如、空、重複、UUID 不正、`Idempotency-Key` 欠如は 400 `INVALID_INPUT`
- 別 Owner または存在しない `dogId` / `walkId` は 404 `NOT_FOUND`
- 既に Active Walk がある開始は 409 `ACTIVE_WALK_EXISTS`
- 同一 Key で異なる body は 409 `IDEMPOTENCY_CONFLICT`
- `recording` ではない Finish は 409 `WALK_NOT_RECORDING`
- Start は Dog 未選択、または foreground / background 未許可のとき無効で、不足理由を表示する
- 許可時は地図と現在地。未許可は地図なし
- Sign Out 承諾時は Active Walk を Failed にしてから session を無効化する
- 画面契約: `walk-spec-mockups.html`
- API 契約: `walk-api-spec.html`

## HOW

### API

```text
BearerAuth middleware
  → principal.cognitoSubject
GET  /v1/walks/active
  → OwnerRepository.resolveByCognitoSubject
  → walks.getActiveByOwner(ownerId)
  → 200 recording  /  204
POST /v1/walks
  → Idempotency-Key と participantDogIds を検証
  → OwnerRepository.resolveByCognitoSubject
  → walks.start({ ownerId, participantDogIds, idempotencyKey })
  → 201 recording
POST /v1/walks/:walkId/finish
  → Idempotency-Key と空 body を検証
  → OwnerRepository.resolveByCognitoSubject
  → walks.finish({ ownerId, walkId, idempotencyKey })
  → 200 completed
Sign Out
  → walks.failIfPresent({ ownerId })
  → Cognito GlobalSignOut
```

| 部品 | 責務 |
| --- | --- |
| `walks` module | GET active、POST 開始、POST Finish の契約、use case、route。`/v1/walks` に mount |
| `WalkRepository.getActiveByOwner` | その Owner の `recording` と participants。無ければ null |
| `WalkRepository.start` | Walk を `recording` で挿入し、Participant を同じ transaction で挿入する。Owner あたり `recording` は 1 件 |
| `WalkRepository.finish` | その Owner の `recording` を Completed にする。距離 0、所要秒を書く |
| `WalkRepository.failIfPresent` | その Owner の `recording` を Failed にする。無ければ何もしない |
| `WalkRepository.rememberCommand` | 開始 / Finish の Idempotency-Key を Endpoint 別名前空間で 24 時間保持する |
| BearerAuth | Owner / Dog と同じ access token 検証。`401 UNAUTHENTICATED` |
| `OwnerRepository.resolveByCognitoSubject` | cognitoSubject から Owner を解決する（既存） |
| Zod | POST 開始は `z.strictObject({ participantDogIds: z.array(z.uuid()).min(1) })`。Finish は `z.strictObject({})` |

`walks` が Walk と participants の応答 schema を所有する。TrackPoint / Event API はこのモジュールに置かない。

PostgreSQL:

| Table | 一意性・参照 |
| --- | --- |
| `walks` | `walk_id` PK。`owner_id` は `owners.owner_id` を参照。`state` は `recording` / `completed` / `failed`。Owner あたり `recording` は 1 件 |
| `walk_participants` | `walk_participant_id` PK。`walk_id` は `walks.walk_id` を参照。`dog_id` は `dogs.dog_id` を参照。`(walk_id, dog_id)` 一意 |
| `walk_command_keys` | `(owner_id, namespace, key)` 一意。`namespace` は `start` / `finish`。同一 Key と同一 body hash は元の Walk を返す。異なる hash は機能 error |

`starting` は画面状態だけ。DB と GET active の Active Walk は `recording`。

Owner あたり 1 件の `recording` は unique index（`owner_id` WHERE `state = 'recording'`）で守る。衝突は repository が機能 error へ変換し、route が 409 `ACTIVE_WALK_EXISTS` にする。

Participant の Dog はその Owner が管理する Dog に限る。満たさない `dogId` は 404 `NOT_FOUND`。

生成後の SQL は `CREATE TABLE` 1 ファイル 1 つ。`walks`、`walk_participants`、`walk_command_keys` を分ける。

### モバイル

| 部品 | 責務 |
| --- | --- |
| `lib/walk-api.ts` | `GET /v1/walks/active`、`POST /v1/walks`、`POST /v1/walks/:walkId/finish` |
| `lib/api.ts` | `Idempotency-Key` を送れるよう header を受け取る |
| `(app)/(tabs)/_layout` | NativeTabs。Dogs と Walk |
| `(app)/(tabs)/index` | Dogs List（現行の認証済みホーム） |
| `(app)/(tabs)/walk` | Walk 画面。Ready / Starting / Recording / Completed / Failed |
| `expo-location` | foreground のあと background を要求する。許可状態で Start と地図を切り替える。background 許可は Info.plist の Always 説明と UIBackgroundModes `location` を使う |
| `expo-maps` `AppleMaps.View` | 許可時の背景。`properties.isMyLocationEnabled` で現在地を出す。カメラは `getCurrentPositionAsync` の座標を `cameraPosition` に渡す |
| Settings Sign Out | `GET /v1/walks/active` が 200 なら確認し、承諾後に sign-out する |

Walk タブを開いたとき `GET /v1/walks/active` と Dog 一覧を取る。`recording` なら Recording、204 なら Ready。

Start は新しい `Idempotency-Key` を画面が持ち、失敗時の Retry は同じ Key と同じ `participantDogIds` を送る。Finish も同様に Finish 用の Key を持つ。

現在地は端末の位置情報で地図に出す。TrackPoint API には送らない。

### 検証

- schema / repository: Owner あたり `recording` 1 件、Participant 1頭以上、別 Owner の Dog は開始できない、Finish は距離 0、`failIfPresent` は `recording` を Failed にする
- route / use case: 200、201、204、400、401、404、409。同一 Idempotency-Key の再送と衝突
- iOS: Ready の不足メッセージ、許可後の地図と現在地、Starting、Recording、Completed、Failed、Start 失敗 Retry

## WHY

Active Walk は Owner あたり 1 件の未完了散歩なので、開始・照合・Finish・Sign Out の Failed を `walks` が同じ記録として扱う。Starting を API に残すと TrackPoint 前に昇格イベントが要る。この縦切りの開始成功は `recording` で足りる。

地図は許可の結果として現在地を見せる。経路は TrackPoint がまだ無いので描かない。

## Official documentation reviewed

| Source | URL | Decision recorded |
| --- | --- | --- |
| Drizzle table declaration | https://orm.drizzle.team/docs/sql-schema-declaration | `walks`、`walk_participants`、`walk_command_keys` を `pgTable` で定義する。 |
| Drizzle column types | https://orm.drizzle.team/docs/column-types/pg | `state` と command `namespace` は enum。日時は timestamptz。 |
| Drizzle indexes / unique | https://orm.drizzle.team/docs/indexes-constraints | `(walk_id, dog_id)` を unique。`owner_id` の unique index を `state = 'recording'` に限定する。 |
| Drizzle insert / transactions | https://orm.drizzle.team/docs/insert | `start` は transaction で Walk と Participant と command key を挿入する。 |
| Drizzle Kit generate | https://orm.drizzle.team/docs/kit-overview | generate 後に `CREATE TABLE` 1 ファイル 1 つへ分割する。 |
| Zod strings / arrays / objects | https://zod.dev/api | `participantDogIds` は `z.array(z.uuid()).min(1)`。Finish body は空の `strictObject`。 |
| Hono routing | https://hono.dev/docs/api/routing | `{ path: '/v1/walks', app: walkRoutes }` に GET `/active`、POST `/`、POST `/:walkId/finish`。 |
| Hono middleware | https://hono.dev/docs/guides/middleware | child app で authentication のあと route を登録する。 |
| Zod OpenAPI | https://hono.dev/examples/zod-openapi | `createRoute` + `security: [{ BearerAuth: [] }]`。Idempotency-Key は header。 |
| Expo Router Native Tabs | https://docs.expo.dev/router/advanced/native-tabs/ | `(app)/(tabs)` に Dogs と Walk の `NativeTabs`。 |
| Expo Location (SDK 57) | https://docs.expo.dev/versions/v57.0.0/sdk/location/ | foreground のあと background を要求する。Info.plist は When In Use と Always。 |
| Expo Maps (SDK 57) | https://docs.expo.dev/versions/v57.0.0/sdk/maps/ | iOS は `AppleMaps.View`。`properties.isMyLocationEnabled` で現在地を出す。 |
| Node.js test runner | https://nodejs.org/api/test.html | `node --import tsx --test`。 |
