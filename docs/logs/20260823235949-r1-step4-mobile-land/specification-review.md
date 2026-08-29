# Specification review

- status: ready
- Purpose: R1 縦切り 4 の TrackPoint モバイル（10秒取得、永続送信キュー、Recording 経路）を現行 main へ載せる
- Active release: R1
- next permitted action: implement approved contract

## Sources

1. `docs/development/staged-development.md`
   - アクティブリリースは R1。開発焦点は散歩記録の縦切り。
   - R1 縦切り 4 は TrackPoint。モバイルが 10秒ごとに取得時刻と位置を送信し、API が SQS Standard へ受理し、worker が `recordedAt` と冪等性で DynamoDB へ確定する。
   - このステップの必須前提に永続送信キューと iOS 位置情報権限（取得元）がある。
   - Recording 中の地図経路は、端末が取得した TrackPoint を `recordedAt` 順に結ぶ。
   - この縦切りの Finish は受理済み点の確定を待たず Completed にする。TrackPoint 0件の Completed は距離 0。
   - Finish 時の未送信吐き出しと受理済み点の DynamoDB 確定は縦切り 5。
2. `docs/specs/external-specification.html`
   - Recording は Background 中も位置情報取得・送信を継続する。
   - TrackPoint 失敗時は取得時刻・位置を保持して自動再送する。専用の失敗画面は無い。
   - AC-WALK-04: Background へ移行した Active Walk でも 10秒間隔の位置取得と `POST /track-points` が継続する。
3. `docs/logs/20260817001133-r1-step4-track-point/specification-review.md`
   - TrackPoint の画面契約と API 契約は承認済み。計画レベルの判断は `staged-development.md` へ同期済み。
   - 自動再試行は Walk が `recording` のあいだ回数上限を設けない。
4. Current implementation (`main` at `cbba1a8`)
   - API は `POST /v1/walks/:walkId/track-points`、SQS 受理、worker の DynamoDB 確定、`GET /health` の worker 確認がある。
   - モバイル `walk-api.ts` に TrackPoint POST は無い。永続送信キュー、10秒取得、Recording 経路は無い。
   - Walk Ready は拒否済み位置情報を設定画面へ案内する。認証期限切れは Sign In へ戻る。
   - TrackPoint モバイル実装は `origin/agent/r1-step4-12-contracts`（PR #79〜#81）にある。このブランチは main の祖先ではない。

## Current release deliverables

1. Recording 中の Walk 画面は Apple MapKit を背景にし、現在地にピンを表示し、端末が保持する TrackPoint を `recordedAt` 順に経路として描く。
2. Recording 中のモバイルは 10秒ごとに位置を取得し、`POST /v1/walks/:walkId/track-points` へ `recordedAt`、`latitude`、`longitude` を送る。
3. 端末は取得時刻と位置を永続キューに保持し、再試行可能な失敗では同じ点を自動再送する。
4. Background 中も位置取得と送信を継続する。Foreground 復帰後も地図、現在地ピン、経路を維持する。
5. Walk Ready の拒否済み位置情報は、現行 main どおり設定画面へ案内する。
6. 認証期限切れは、現行 main どおり Sign In へ戻る。

## Decisions

- Plan-level (confirmed in TrackPoint session): 順序と冪等の正本は `recordedAt`。自動再試行は `recording` のあいだ回数上限なし。Finish の DynamoDB 確定待ちは縦切り 5。距離は 0。
- Implementation-local (confirmed): 搭載元は `origin/agent/r1-step4-12-contracts` のモバイル TrackPoint ファイル。現行 main へ載せ、位置情報の設定案内と認証期限切れの Sign In を残す。
- Implementation-local (confirmed): `expo-file-system` と `expo-task-manager` を現行 Expo 57.0.15 ピンのまま追加する。積み上げブランチの一括パッケージ更新は持ち込まない。
- Implementation-local (confirmed): Finish 前に端末キューを POST し切る。DynamoDB 確定待ちは入れない。未送信点を Completed 前に落とさない。確定待ちは縦切り 5。
- Deferred: Finish の受理済み点 DynamoDB 確定、Event、距離 / pace、Walk Detail、起動 / Foreground / タブ移動の実機検証。
- Out of plan: なし。

## Verification conditions

- Recording 中は 10秒間隔で位置を取得し、`recordedAt`、`latitude`、`longitude` を送る。
- 位置情報許可時の Recording 画面は Apple MapKit を背景にし、現在地にピンを表示し、取得した点を `recordedAt` 順に経路として描く。
- Background へ移行した Recording でも 10秒間隔の取得と送信が継続する。復帰後も地図、現在地ピン、経路を維持する。
- 再試行可能な送信失敗は Recording を維持し、同じ点を自動再送する。専用の失敗画面は出さない。
- 拒否済み位置情報の Ready は「設定を開く」を表示し、Settings を開く。
- 認証期限切れは Sign In へ戻る。
- Finish は端末キューを POST し切ったあと Completed にする。距離は 0。DynamoDB 確定は待たない。

## Gaps checked

- Release boundaries: このセッションは縦切り 4 のモバイル欠落を main へ載せる。API / worker は導入済み。DynamoDB 確定待ちは縦切り 5。
- Specification preconditions: Cognito、認証状態、API クライアント、位置情報権限、SQS / DynamoDB、worker ヘルスは導入済み。永続送信キューと 10秒送信は未導入。
- Implementation evidence: main の `apps/mobile/src/lib` に TrackPoint キューが無い。積み上げブランチにキュー、位置タスク、経路ストア、Walk 画面の経路描画がある。
- Product contract presentation: 画面は `track-point-spec-mockups.html`、API は `track-point-api-spec.html`（TrackPoint セッションの契約を再利用）。

## Product contract presentation

- Screen: `track-point-spec-mockups.html`（Recording の 10秒送信、地図・ピン・経路、Background 継続、自動再送）
- HTTP API: `track-point-api-spec.html`（`POST /v1/walks/:walkId/track-points`。このセッションでは API を変えない）
