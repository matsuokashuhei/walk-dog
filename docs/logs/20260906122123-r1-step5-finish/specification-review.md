# Specification review

- status: ready
- Purpose: R1 Step 5 の Finish（未送信吐き出し後、受理済み TrackPoint の DynamoDB 確定を待って Completed）
- Active release: R1
- next permitted action: implementation plan（design.md の確認待ち）

## Sources

1. `docs/development/staged-development.md`
   - アクティブリリースは R1。開発焦点は散歩記録の縦切り。
   - R1 縦切り 5 は Finish。受理済み TrackPoint の処理確定後に Completed へ遷移する。
   - 必須前提: Cognito、モバイル認証状態、モバイル API クライアント、永続送信キュー（未送信の吐き出し）、iOS 位置情報権限（記録継続）、SQS / DynamoDB、Compose（ElasticMQ / DynamoDB Local）、worker骨格 + ヘルス。
   - Finishは、端末が未送信 TrackPoint を API へ吐き出したあと、`POST /v1/walks/:walkId/finish` がその Walk の PostgreSQL 受理済み点がすべて DynamoDB に存在するまで待ってから Completed へ遷移する。TrackPoint 0件は待ちなし。確定待ちが再試行可能な失敗のときは Completed にせず、Recording を維持して同じ Finish を Retry する。
   - `durationSeconds` は `startedAt` から `completedAt` までの秒。`distanceMeters` はこの縦切りでは 0。`paceSecondsPerMeter` は距離0のため `null`。
   - 検証: SQSワーカーテストで重複、順不同、再配信、Finish時の受理済み点確定を確認する。
2. `docs/specs/external-specification.html`
   - Finish 失敗時は Recording を維持し、手動 Retry を可能にする。
   - Finish 成功時に Completed とする。Walk Detail へ遷移する表示は後続縦切り。
   - `POST /walks/:walkId/finish` は `{}` + `Idempotency-Key` で Completed Walk を返す。
   - TrackPoint が 0件でも Completed Walk は距離 0 で成立する。
   - Start用とFinish用の `Idempotency-Key` は Endpoint ごとに別名前空間。Key の有効期間は処理開始から24時間。同一Keyの処理中は確定まで再送を待つ。
   - AC-WALK-05: Finish 失敗時は Recording 維持、Retry。
3. `docs/logs/20260817001133-r1-step4-track-point/specification-review.md`
   - Finish 時の未送信吐き出しと受理済み点の確定は縦切り 5。
4. `docs/logs/20260823235949-r1-step4-mobile-land/specification-review.md`
   - Finish 前に端末キューを POST し切る。DynamoDB 確定待ちは縦切り 5。
5. Current implementation (`origin/main` @ `27dc96f`)
   - API `POST /v1/walks/:walkId/finish` は PostgreSQL 上で `recording` → `completed` し、DynamoDB 確定は待たない。
   - TrackPoint 受理は PostgreSQL `walk_track_points` へ保存し、SQS へ enqueue。worker が DynamoDB `TrackPoints` へ confirm。
   - モバイル Finish は sampling を止め、outbound queue を flush し、残件があると Finish 失敗、空なら `POST /finish`。DynamoDB 確定待ちは無い。

## Current release deliverables

1. Finish 操作は、端末の未送信 TrackPoint を API へ吐き出したあと、API が受理済み点の DynamoDB 確定を待って Completed にする。
2. TrackPoint 0件の Walk は待ちなしで Completed にし、距離は 0。
3. Finish 失敗時は Recording を維持し、同じ Finish を手動 Retry できる。
4. Completed 応答の `distanceMeters` は 0、`paceSecondsPerMeter` は `null`、`durationSeconds` は開始から完了までの秒。
5. worker は受理済み点の確定を Finish が観測できる形で完了する（重複・再配信を含む）。

## Decisions

- Plan-level (confirmed): `POST /v1/walks/:walkId/finish` が Completed を返す前に、その Walk の PostgreSQL 受理済み点がすべて DynamoDB に存在するまで待つ。TrackPoint 0件は待ちなし。距離は 0。計画書へ同期済み。
- Plan-level (confirmed): 確定待ちが再試行可能な失敗（タイムアウト・一時障害）のとき、Finish は Completed にせず、クライアントは Recording を維持して同じ Finish を Retry する。計画書へ同期済み。
- Implementation-local (proposed): 待ちの実装は API 側。モバイルは現行どおり flush → POST finish。新しい画面状態は増やさない。確定待ち失敗は 503 `SERVICE_UNAVAILABLE` / `retryable: true`。
- Deferred: Event、距離 / pace の経路由来値、Walk Detail、起動 / Foreground / タブ移動の実機検証。
- Out of plan: なし。

## Verification conditions

- 有効な Access Token と `recording` Walk への Finish は、受理済み点が DynamoDB に揃ったあと 200 と Completed Walk を返す。
- TrackPoint 0件の Finish は待ちなしで Completed、`distanceMeters` は 0。
- Finish 失敗時は Recording を維持し、同じ `Idempotency-Key` で Retry できる。
- 確定待ちの再試行可能な失敗は 503 `SERVICE_UNAVAILABLE`、`retryable: true`。
- Access Token 欠如または不正は 401 `UNAUTHENTICATED`。
- `recording` ではない Walk は 409 `WALK_NOT_RECORDING`。
- 別 Owner または存在しない `walkId` は 404 `NOT_FOUND`。
- 同一 Finish Key で異なる body は 409 `IDEMPOTENCY_CONFLICT`（body は `{}`）。
- worker の重複・順不同・再配信でも、Finish は受理済み点の確定後にだけ Completed する。
- モバイルは Finish 前に outbound queue を空にし、残件があるあいだは `POST /finish` しない。

## Gaps checked

- Release boundaries: 縦切り 5 は Finish の確定待ちと未送信吐き出しの完了条件を所有する。Event / Walk Detail / 距離算出 / 実機ライフサイクルは後続。
- Specification preconditions: Cognito、認証状態、API クライアント、永続キュー、位置情報、SQS / DynamoDB、Compose、worker は main 導入済み。
- Implementation evidence: Finish は確定待ちなし。モバイルは flush 済み。worker confirm は導入済み。
- Product contract presentation: 画面は `finish-spec-mockups.html`。HTTP API は `finish-api-spec.html`。ユーザー承認済み（2026-09-06）。

## Product contract presentation

- Screen: presented in `finish-spec-mockups.html` (Recording Finish、失敗 Retry、Completed 距離 0)
- HTTP API: presented in `finish-api-spec.html` (`POST /v1/walks/:walkId/finish` request, response, DynamoDB wait, 503 retry)
