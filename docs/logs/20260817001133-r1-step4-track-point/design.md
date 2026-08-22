# TrackPoint 設計

> WHAT → HOW → WHY

## WHAT

R1 Step 4 の TrackPoint を API、worker、モバイルで提供する。Owner は Recording 中に 10秒ごとに位置を送り、API はそれを受理し、worker が DynamoDB へ確定する。Recording 画面は地図背景の上に現在地ピンと、端末が保持する点の経路を出す。

| 提供 | 内容 |
| --- | --- |
| TrackPoint 受理 | `POST /v1/walks/:walkId/track-points` `{ recordedAt, latitude, longitude }` → 201 TrackPoint。SQS へ送る |
| 冪等 | 同一 `walkId` + `recordedAt` で同一座標なら受理済み TrackPoint。座標が違うときは 409 `IDEMPOTENCY_CONFLICT` |
| 確定 | worker が SQS を long poll し、`walkId` + `recordedAt` をキーに DynamoDB へ 1 件書く |
| ヘルス | `GET /health` は API process、worker process、PostgreSQL が稼働中なら 200 |
| Recording 送信 | 10秒ごとに位置を取得し、ピンを現在地へ移し、経路に点を足し、POST する |
| 経路 | 端末が保持する TrackPoint を `recordedAt` 順に結ぶ |
| 再試行 | 429 / 5xx は Recording のまま同じ点を自動再送する。専用の失敗画面は出さない |
| Background | Recording 中は位置取得と送信を続ける。復帰後も地図、ピン、経路を維持する |

受け入れ:

| 対象 | 入力 | 結果 |
| --- | --- | --- |
| POST track-points | 有効 token、その Owner の `recording` Walk、`recordedAt` / `latitude` / `longitude` | 201 と TrackPoint（`requestId`、`trackPointId`、`walkId`、`recordedAt`、`latitude`、`longitude`） |
| replay | 同一 `walkId` + `recordedAt`、同一座標 | 受理済み TrackPoint |
| conflict | 同一 `walkId` + `recordedAt`、異なる座標 | 409 `IDEMPOTENCY_CONFLICT` |
| unauthenticated | Authorization 欠如または不正 | 401 `UNAUTHENTICATED` |
| invalid input | `recordedAt` / `latitude` / `longitude` の欠如または不正 | 400 `INVALID_INPUT` |
| missing walk | 別 Owner または存在しない `walkId` | 404 `NOT_FOUND` |
| not recording | `completed` / `failed` Walk | 409 `WALK_NOT_RECORDING` |
| worker | 重複、順序違い、再配送 | `walkId` + `recordedAt` ごとに DynamoDB 1 件 |
| GET /health | API + worker + PostgreSQL が稼働 | 200 `{ status: "ok" }` |
| GET /health | worker または PostgreSQL が再試行可能な接続状態 | 503 `DEPENDENCY_UNAVAILABLE`、`retryable: true` |
| Recording 10s | 経過 10秒 | 点を取得し、ピンを動かし、経路を伸ばし、POST する |
| Background | Recording が Background になる | 取得と送信を続ける。復帰後も地図、ピン、経路を維持する |
| retryable fail | 429 または 5xx | Recording のまま同じ点を自動再送する。専用の失敗 UI は出さない |
| iOS evidence | Recording | 地図背景、ピン、経路、Background 復帰後の維持 |

画面契約: `track-point-spec-mockups.html`。API 契約: `track-point-api-spec.html`。

この縦切りの Finish は受理済み点の DynamoDB 確定を待たず Completed にする。距離は 0。Event、Walk Detail の経路、距離 / pace の経路由来値は後続である。

## HOW

### API

```text
BearerAuth middleware
  → principal.cognitoSubject
POST /v1/walks/:walkId/track-points
  → recordedAt / latitude / longitude を検証
  → OwnerRepository.resolveByCognitoSubject
  → walks.acceptTrackPoint({ ownerId, walkId, recordedAt, latitude, longitude })
  → SQS へ送る
  → 201 TrackPoint
GET /health
  → API process、worker /health、PostgreSQL
  → 200 ok  /  503 DEPENDENCY_UNAVAILABLE
```

| 部品 | 責務 |
| --- | --- |
| `walks` module | 既存の Active Walk 契約に加え、POST track-points の契約、use case、route。`/v1/walks` に mount |
| `WalkRepository.getActiveByOwner` ほか | 既存。Owner と `recording` の判定は開始 / Finish / DELETE と同じ |
| `WalkRepository.acceptTrackPoint` | その Owner の `recording` Walk なら `trackPointId` を発行し、受理行を PostgreSQL に書く。同一 `walkId` + `recordedAt` で同一座標なら既存行を返す。座標が違うときは機能 error |
| TrackPoint queue provider | 受理した TrackPoint を SQS Standard へ送る。replay でも送る。worker の DynamoDB 書き込みは冪等 |
| SQS adapter | SDK `SendMessage` を queue provider へ変換する。queue URL と endpoint は注入された config / client |
| DynamoDB adapter | worker が `walkId` + `recordedAt` で条件付き put する。既存件が同一座標なら確定済みとして扱う |
| BearerAuth | Owner / Dog / Walk と同じ access token 検証。`401 UNAUTHENTICATED` |
| Zod | `z.strictObject({ recordedAt: z.iso.datetime(), latitude: z.number().gte(-90).lte(90), longitude: z.number().gte(-180).lte(180) })` |
| Health | API process 自身、`WORKER_HEALTH_URL` の GET、PostgreSQL の接続確認 |

`walks` が TrackPoint 応答 schema を所有する。Event API はこのモジュールに置かない。この endpoint は `Idempotency-Key` header を使わない。冪等の正本は `walkId` + `recordedAt` である。

受理の流れ:

1. token から Owner を解決する。
2. その Owner の Walk を `walkId` で取る。無ければ 404。`recording` でなければ 409 `WALK_NOT_RECORDING`。
3. `(walkId, recordedAt)` の受理行を取る。
4. 既存行があり座標が同じなら、SQS へ送り、その TrackPoint を 201 で返す。
5. 既存行があり座標が違うなら 409 `IDEMPOTENCY_CONFLICT`。
6. 無ければ `trackPointId` を発行して受理行を挿入し、SQS へ送り、201 で返す。
7. SQS 送信が失敗したら 5xx、`retryable: true`。受理行が残っていれば再送は replay 経路で再び SQS へ送る。

PostgreSQL:

| Table | 一意性・参照 | 公開契約 |
| --- | --- | --- |
| `walks` ほか | 既存 | Active Walk |
| `walk_track_points` | `track_point_id` PK。`walk_id` は `walks.walk_id` を参照。`(walk_id, recorded_at)` 一意 | HTTP が返す TrackPoint。`trackPointId`、`walkId`、`recordedAt`、`latitude`、`longitude` |

HTTP の 201 は worker 完了を待たない。replay が同じ `trackPointId` を返すために、受理は PostgreSQL に残す。

生成後の SQL は `CREATE TABLE` 1 ファイル 1 つ。`walk_track_points` を分ける。

429 と 5xx は既存 envelope で `retryable: true`。入力・認証・不在・状態・冪等衝突は `retryable: false`。

### worker

同一 API package の第二 process。Compose では同一 image を `node dist/worker.js` で起動する。

```text
SQS long poll
  → message の trackPointId / walkId / recordedAt / latitude / longitude
  → DynamoDB へ walkId + recordedAt で条件付き put
  → 成功または同一座標の既存件なら message を削除
GET /health（Docker network 内）
  → 200 ok
```

| 部品 | 責務 |
| --- | --- |
| worker process | SQS の新規 long poll を回し、1 件処理して削除する。SIGTERM / SIGINT で新規 poll を止め、処理中を確定して終了する |
| worker health | Docker network 内で自身の稼働を返す。API の `GET /health` がこれを確認する |
| DynamoDB item | キーは `walkId` と `recordedAt`。属性は `trackPointId`、`latitude`、`longitude`。重複・再配送・順序違いは 1 キー 1 件 |

SQS Standard は少なくとも 1 回届ける。worker は届いた順に書く。順序は `recordedAt` が担う。同一キーの再配送は既存件が同一座標なら確定済みとする。

### 設定と Compose

| 設定 | 用途 |
| --- | --- |
| `SQS_QUEUE_URL` | TrackPoint 受理キュー |
| `SQS_ENDPOINT` | 開発 / CI の ElasticMQ |
| `DYNAMODB_TABLE` | TrackPoint 確定テーブル |
| `DYNAMODB_ENDPOINT` | 開発 / CI の DynamoDB Local |
| `AWS_REGION` | SDK client |
| `WORKER_HEALTH_URL` | API が worker `/health` を確認する URL |

開発 / CI は endpoint URL を検証する。VPS は AWS 標準 endpoint を使う。S3 / RustFS はこの縦切りに含めない。

Compose は既存の PostgreSQL と API に加え、ElasticMQ、DynamoDB Local、worker を提供する。API の `GET /health` が 200 になる前提は、API、worker、PostgreSQL が稼働していることである。

起動時に DynamoDB テーブルが無ければ作成する。キーは `walkId`（partition）と `recordedAt`（sort）。

### モバイル

| 部品 | 責務 |
| --- | --- |
| `lib/walk-api.ts` | 既存 Walk API に加え `POST /v1/walks/:walkId/track-points` |
| Walk 永続送信キュー | 未受理点 `{ walkId, recordedAt, latitude, longitude }` を保持し、201 で外す。429 / 5xx は同じ点を再送する |
| 経路ストア | 取得した点をすべて保持する。201 のあとも経路に残す |
| `(app)/(tabs)/walk` | Recording は地図背景、経過時間、犬名、Finish。ピンと経路を重ねる |
| `expo-location` | Recording 中は 10秒間隔で位置を取る。Background でも続ける |
| `expo-maps` `AppleMaps.View` | 許可時の背景。`markers` に現在地ピン 1 つ。`polylines` に `recordedAt` 順の座標 |

Recording に入ると 10秒間隔の位置取得を始める。各取得で:

1. `recordedAt`、`latitude`、`longitude` を経路ストアへ足す。
2. ピンをその座標へ移し、polyline の座標を経路ストアの順で更新する。
3. 同じ点を永続送信キューへ載せ、POST する。

201 はキューから外し、経路には残す。同一点の replay 201 もキューから外す。

400 / 404 / 409 は自動再送しない。401 は既存の Failed と再認証へ進む。Walk が `recording` のあいだ、429 / 5xx の回数上限は設けない。

Finish / Failed / Ready へ移ると、この縦切りでは自動再送を止める。未受理点は端末に残す。吐き出しと受理済み点の確定待ちは縦切り 5 である。

Background では取得と送信を続ける。Foreground 復帰後は経路ストアと最新点から地図、ピン、経路を描き直す。

現在地ピンは最新の取得座標を `AppleMaps.View` の `markers` に 1 件置く。経路は `polylines` の `coordinates` に経路ストアの点を `recordedAt` 順で渡す。カメラは最新点を見る。

### 検証

| 層 | 確認すること |
| --- | --- |
| schema / repository | `(walk_id, recorded_at)` 一意。同一座標は既存 TrackPoint。異なる座標は機能 error。`recording` 以外は受理しない |
| route / use case | 201、400、401、404、409。replay と `IDEMPOTENCY_CONFLICT`。SQS 送信後に 201 |
| adapter | SQS `SendMessage`。DynamoDB 条件付き put。再配送は 1 キー 1 件 |
| health | 三者稼働で 200。worker または PostgreSQL の再試行可能な接続状態で 503 |
| worker | 重複、順序違い、再配送でも DynamoDB は `walkId` + `recordedAt` ごとに 1 件 |
| iOS | 10秒取得、ピン移動、経路延長、Background 継続、復帰後の地図 / ピン / 経路、retryable 失敗時も Recording のまま自動再送 |

## WHY

TrackPoint は Active Walk の Recording 中にだけ成立する点なので、Owner 判定と `recording` 判定は `walks` が同じ記録として扱う。`recordedAt` が Walk 内の順序と冪等の正本なので、連番は置かない。

HTTP の 201 は「受理した」ことであり、worker の DynamoDB 書き込みは少なくとも 1 回届く配送の確定である。受理行を PostgreSQL に残すと、worker 完了前の replay が同じ `trackPointId` を返す。SQS Standard の重複は DynamoDB の `walkId` + `recordedAt` で 1 件に畳む。

Recording の経路は、送信待ちや worker 確定を待たず Owner が見る線である。データソースは端末が保持する点にする。Walk Detail の経路と距離 / pace は後続の確定点を使う。

自動再送を Recording 中に限ると、専用の失敗画面を出さずに同じ点を送り続けられる。Finish の確定待ちはこの縦切りの Completed に含めない。

## Official documentation reviewed

| Source | URL | Decision recorded |
| --- | --- | --- |
| Drizzle table declaration | https://orm.drizzle.team/docs/sql-schema-declaration | `walk_track_points` を `pgTable` で定義する。 |
| Drizzle column types | https://orm.drizzle.team/docs/column-types/pg | `recorded_at` は timestamptz。緯度経度は double precision。 |
| Drizzle indexes / unique | https://orm.drizzle.team/docs/indexes-constraints | `(walk_id, recorded_at)` を unique にする。 |
| Drizzle insert | https://orm.drizzle.team/docs/insert | 受理行の挿入。一意衝突は既存行の座標照合へ変換する。 |
| Drizzle Kit generate | https://orm.drizzle.team/docs/kit-overview | generate 後に `CREATE TABLE` 1 ファイル 1 つへ分割する。 |
| Zod objects / numbers / iso | https://zod.dev/api | body は `strictObject`。`recordedAt` は `z.iso.datetime()`。緯度経度は範囲付き number。 |
| Hono routing | https://hono.dev/docs/api/routing | `{ path: '/v1/walks', app: walkRoutes }` に POST `/:walkId/track-points`。 |
| Hono middleware | https://hono.dev/docs/guides/middleware | child app で authentication のあと route を登録する。 |
| Zod OpenAPI | https://hono.dev/examples/zod-openapi | `createRoute` + `security: [{ BearerAuth: [] }]`。 |
| AWS SDK SQS SendMessage | https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html | 受理後に `SendMessage`。replay でも送る。 |
| AWS SDK SQS ReceiveMessage | https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ReceiveMessage.html | worker は long poll する。 |
| AWS SDK DynamoDB PutItem | https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html | `walkId` + `recordedAt` の条件付き put。既存同一座標は確定済み。 |
| Expo Location (SDK 57) | https://docs.expo.dev/versions/v57.0.0/sdk/location/ | Recording 中は `timeInterval` 10000 の位置更新を Background でも続ける。 |
| Expo Maps (SDK 57) | https://docs.expo.dev/versions/v57.0.0/sdk/maps/ | iOS は `AppleMaps.View`。ピンは `markers`。経路は `polylines`。 |
| Node.js test runner | https://nodejs.org/api/test.html | `node --import tsx --test`。 |
