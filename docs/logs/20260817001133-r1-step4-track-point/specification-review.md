# Specification review

- status: ready
- Purpose: R1 Step 4 の TrackPoint（10秒ごと送信 → API 受理 → SQS → worker → DynamoDB）を実装する
- Active release: R1
- next permitted action: implementation（plan.md の確認待ち）

## Sources

1. `docs/development/staged-development.md`
   - アクティブリリースは R1。開発焦点は散歩記録の縦切り。
   - R1 縦切り 4 は TrackPoint。モバイルが 10秒ごとに取得時刻と位置を送信し、API が SQS Standard へ受理し、worker が `recordedAt` と冪等性で DynamoDB へ確定する。
   - このステップの必須前提: Cognito（API側トークン検証）、モバイル認証状態、モバイル API クライアント、永続送信キュー、iOS 位置情報権限（取得元）、SQS / DynamoDB 接続、Compose（ElasticMQ / DynamoDB Local）、worker骨格 + ヘルス。
   - Docker / ECR は配布・VPS反映の前提。S3 はこのステップの必須前提ではない。
   - Finish の受理済み TrackPoint 確定は縦切り 5。Event と Walk Detail（距離・時間・Event、完了後の経路）は縦切り 6。起動 / Foreground 復帰 / タブ移動の実機検証は縦切り 7。
   - Recording 中の地図経路は、端末が取得した TrackPoint を `recordedAt` 順に結ぶ。
   - この縦切りの Finish は受理済み点の確定を待たず Completed にする。TrackPoint 0件の Completed は距離 0。
   - 製品契約の POST body は `{ recordedAt, latitude, longitude }`。`recordedAt` が Walk 内の順序と冪等の正本。
   - TrackPoint 自動再試行の回数と時間上限は、このステップ着手時に確定する。
   - 公開インターフェースは `/v1` 配下に TrackPoint API を段階ごとに追加する。
2. `docs/specs/external-specification.html`
   - Recording は Background 中も Walk と位置情報取得・送信を継続する。
   - `POST /walks/:walkId/track-points` は `{ recordedAt, latitude, longitude }` を受け、TrackPoint を返す。
   - TrackPoint と Event は Recording 中に受け付ける。
   - TrackPoint 失敗時は取得時刻・位置・順序を保持して自動再送する。専用の失敗画面は無い。
   - TrackPoint 項目は `trackPointId`、`walkId`、`recordedAt`、`latitude` / `longitude`。緯度・経度は有効値。
   - AC-WALK-04: Background へ移行した Active Walk でも 10秒間隔の位置取得と `POST /track-points` が継続する。
   - Walk 画面の距離・pace・Event・Walk Detail は製品契約にあるが、計画書では後続縦切り。Recording の経路はこの縦切りで描く。
3. `docs/specs/2026-07-26-hono-api-r0-design.md`
   - `api` と `worker` は同一 Docker image から専用 container として起動する。
   - 開発環境は PostgreSQL、DynamoDB Local、ElasticMQ、RustFS を Compose で提供する。このステップの必須は ElasticMQ と DynamoDB Local。
   - API は TrackPoint を SQS へ受理し、worker は SQS long polling で処理する。
   - `GET /health` は API process、worker process、PostgreSQL の稼働状態を返す。
4. `docs/logs/20260815115403-r1-step3-active-walk/specification-review.md`
   - TrackPoint 送信はこの縦切り。Finish の受理済み点確定は縦切り 5。
   - Starting は開始要求中の画面状態。API の `starting` 永続化は TrackPoint 縦切りで扱う、と後続にした。
   - 現在地表示は端末 GPS。Step 3 では TrackPoint API に送らない。
5. Current implementation
   - Walk API は `GET /v1/walks/active`、`POST /v1/walks`、`POST /v1/walks/:walkId/finish`、`DELETE /v1/walks/:walkId`。TrackPoint route は無い。
   - モバイル Walk 画面は Ready / Starting / Recording / Completed / Failed。位置情報許可と現在地表示はある。10秒送信と永続送信キューは無い。
   - Compose は PostgreSQL と API。ElasticMQ、DynamoDB Local、worker process は無い。
   - API config は Cognito / PostgreSQL / 観測性。SQS / DynamoDB 接続設定は無い。`GET /health` は API process の `ok`。

## Current release deliverables

1. Recording 中の Walk 画面は Apple MapKit を背景にし、現在地にピンを表示し、取得した TrackPoint を経路として描く。
2. Recording 中のモバイルは 10秒ごとに位置を取得し、`POST /v1/walks/:walkId/track-points` へ `recordedAt`、`latitude`、`longitude` を送る。ピンは現在地へ移動し、経路に点を足す。
3. 端末は取得時刻・位置・順序を永続キューに保持し、再試行可能な失敗では同じ点を自動再送する。
4. Background 中も位置取得と送信を継続する。復帰後も地図、現在地ピン、経路を維持する。
5. API は Access Token で認証し、その Owner の `recording` Walk の TrackPoint を SQS へ受理して TrackPoint を返す。
6. worker は SQS から受け取り、`recordedAt` と冪等性で DynamoDB へ確定する。
7. Compose は ElasticMQ と DynamoDB Local を提供し、worker 骨格はヘルスを返す。

## Decisions

- Plan-level (confirmed): TrackPoint の順序と冪等の正本は `recordedAt`。Request / Response に `sequence` は置かない。同一 `walkId` と `recordedAt` の再送は、同じ `latitude` / `longitude` なら受理済み TrackPoint を返す。位置が違うときは 409 `IDEMPOTENCY_CONFLICT`。
- Plan-level (confirmed): R1 の公開インターフェースに `POST /v1/walks/:walkId/track-points` を追加する。Request body は `recordedAt`、`latitude`、`longitude`。
- Plan-level (confirmed): TrackPoint 自動再試行は、Walk が `recording` のあいだ回数上限を設けない。保持期限は Active Walk が `recording` のあいだ。Finish 時の未送信吐き出しと受理済み点の確定は縦切り 5。
- Plan-level (confirmed): Starting は Step 3 どおり開始要求中の画面状態のままにする。API の `starting` 永続化はこのセッションに含めない。TrackPoint は `recording` 中に受け付ける。
- Plan-level (confirmed): このステップの Finish は受理済み点の確定を待たず Completed にする。距離は 0 のまま。
- Plan-level (confirmed): 位置情報許可時の Recording 画面は Apple MapKit を背景にし、現在地にピンを表示する。取得した TrackPoint を `recordedAt` 順に結んで経路を描く。データソースは端末が保持する点。距離・pace・Walk Detail の経路は後続。
- Implementation-local (proposed): TrackPoint は既存の `walks` module に置き、モバイルの HTTP 呼び出しは `lib/walk-api.ts` に追加する。永続送信キューは端末の送信待ちとして Walk 機能に置く。
- Implementation-local (proposed): Compose に ElasticMQ と DynamoDB Local を追加する。worker は同一 API image の `node dist/worker.js`。S3 / RustFS はこのステップに含めない。
- Implementation-local (proposed): エラー envelope は既存 API と同じ `code` / `message` / `requestId` / `retryable`。`recording` ではない Walk への送信は 409 `WALK_NOT_RECORDING`。
- Deferred: Finish の受理済み TrackPoint 確定、Event、距離 / pace の経路由来値、Walk Detail、起動 / Foreground / タブ移動の実機検証、S3 / Avatar、Docker / ECR の配布反映。
- Out of plan: なし。製品契約の Recording 距離・pace・Event 表示は後続縦切りとして扱う。

## Verification conditions

- Recording 中は 10秒間隔で位置を取得し、`recordedAt`、`latitude`、`longitude` を送る。
- 位置情報許可時の Recording 画面は Apple MapKit を背景にし、現在地にピンを表示し、取得した点を `recordedAt` 順に経路として描く。
- Background へ移行した Recording でも 10秒間隔の取得と送信が継続する。復帰後も地図、現在地ピン、経路を維持する。
- 有効な Access Token と `recording` Walk への `POST /v1/walks/:walkId/track-points` は 201 と TrackPoint を返す。
- 同一 `walkId` と `recordedAt`、同一 body の再送は受理済み TrackPoint を返す。
- Access Token 欠如または不正は 401 `UNAUTHENTICATED`。
- `recordedAt` / `latitude` / `longitude` の欠如または不正は 400 `INVALID_INPUT`。
- 別 Owner または存在しない `walkId` は 404 `NOT_FOUND`。
- `recording` ではない Walk は 409 `WALK_NOT_RECORDING`。
- 同一 `recordedAt` で異なる位置は 409 `IDEMPOTENCY_CONFLICT`。
- 429 と 5xx は `retryable: true`。端末は同じ点を自動再送する。
- TrackPoint 送信失敗は Recording 画面を維持し、専用の失敗メッセージを出さない。
- worker は受理した TrackPoint を DynamoDB へ確定する。重複と再配信は同じ `recordedAt` の点として確定する。
- `GET /health` は API、worker、PostgreSQL が稼働中のとき 200 を返す。

## Gaps checked

- Release boundaries: TrackPoint 縦切りが 10秒送信、永続キュー、SQS 受理、worker 確定、Recording 地図の経路を所有する。Finish の受理済み点待ち、Event、Walk Detail、実機ライフサイクル検証は後続。
- Specification preconditions: Cognito、モバイル認証状態、API クライアント、位置情報権限は導入済み。永続送信キュー、SQS / DynamoDB、ElasticMQ / DynamoDB Local、worker 骨格 + ヘルスはこのステップ直前の必須前提で、未導入。
- Implementation evidence: TrackPoint route は無い。モバイルは現在地表示まで。Compose は PostgreSQL のみ。worker process は無い。
- Product contract presentation: 画面は `track-point-spec-mockups.html`（地図背景、現在地ピン、経路）、API は `track-point-api-spec.html`。ユーザーが契約 HTML を承認した。計画レベルの判断は `docs/development/staged-development.md` へ同期済み。

## Product contract presentation

- Screen: presented in `track-point-spec-mockups.html` (Recording 中の 10秒送信、地図背景、現在地ピン、経路、Background 継続、自動再送)
- HTTP API: presented in `track-point-api-spec.html` (`POST /v1/walks/:walkId/track-points` request, response, and behavior)
