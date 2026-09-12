# Specification review

- status: ready
- Purpose: R1 Step 7 の実機検証（起動／Foreground 復帰／タブ移動での Active Walk 照合、バックグラウンド位置、通信復帰）
- Active release: R1
- next permitted action: plan 実行方法の選択（subagent-driven / inline）

## Sources

1. `docs/development/staged-development.md`
   - アクティブリリースは R1。開発焦点は散歩記録の縦切り。
   - R1 縦切り 7 は実機検証。起動／Foreground 復帰／タブ移動での Active Walk 照合、バックグラウンド位置。
   - 必須前提: Cognito、モバイル認証状態、モバイル API クライアント、永続送信キュー（通信復帰）、iOS 位置情報権限、worker 骨格 + ヘルス。ローカル API 実機では Compose（ElasticMQ / DynamoDB Local / S3 互換）が前提。
   - R1 本文: 起動、Foreground 復帰、タブ移動時に Active Walk を照合し、バックグラウンド位置記録を iPhone 実機で検証する。
   - TrackPoint の送信失敗は取得時刻と位置を保持し、Walk が `recording` のあいだ回数上限なく自動再送する。
2. `docs/specs/external-specification.html`
   - Recording は Background 中も Walk と位置情報取得・送信を継続する。
   - Active 消失: API 上の Active Walk が消えた場合、端末側の Walk を failed として破棄。
   - AC-WALK-03: API に Active Walk がある状態でアプリ再起動 → Recording 復元。
   - AC-WALK-04: Background へ移行後も 10 秒間隔の位置取得・送信が継続。
   - AC-WALK-06: 再照合で Active 消失 → 端末側を Failed として破棄。
   - `GET /walks/active` は Active Walk または 204。
3. `docs/logs/20260906142148-r1-step6-event-detail/specification-review.md`
   - 起動 / Foreground / タブ移動の実機検証は縦切り 7 へ Deferred。
4. Current implementation (`origin/main` @ `b82d752`)
   - Walk 画面は focus と AppState `active` で `getActiveWalk` / `verifyRecording` を呼ぶ。
   - Active が無い Recording 照合は Failed。位置許可喪失時は `deleteWalk` のあと Failed。
   - `walk-location-task` が background location updates と 10 秒サンプル、永続キュー flush を行う。
   - 物理 iPhone 向けの LAN Compose 接続手順と、縦切り 7 専用の E2E 証跡は未整備。

## Current release deliverables

1. アプリ起動後に Walk を表示したとき、`GET /v1/walks/active` で Active Walk があれば Recording を復元する。
2. Foreground 復帰時に Active Walk を再照合する。Recording 中に Active が無ければ Failed にする。
3. Walk タブへの移動（focus）でも同じ照合を行う。
4. Background 中も位置を取得し、10 秒間隔の TrackPoint を永続キュー経由で API へ送る。
5. 通信断で送れなかった TrackPoint は、Recording のあいだ回数上限なく自動再送する。
6. 受け入れは iPhone 実機と、同一 LAN のローカル Compose API で行う。

## Decisions

- Implementation-local (proposed): このセッションの受け入れ API はローカル Compose（同一 LAN）。VPS API 実機は後続。
- Implementation-local (proposed): 受け入れ端末は iPhone 実機。シミュレータだけの合格は認めない。
- Implementation-local (proposed): 新規 HTTP エンドポイントは追加しない。ギャップがあれば既存の照合・位置・キュー実装を直す。
- Deferred: VPS API 実機検証、配布・ECR 反映、R2 履歴一覧、Avatar / S3。
- Out of plan: なし。
- Plan-level: なし（計画書の縦切り 7 と一致。追加の計画書変更は不要）。

## Verification conditions

- AC-WALK-03: Active Walk がある状態でアプリを再起動し Walk を開くと Recording を表示する。
- Foreground 復帰と Walk タブ focus で Active Walk を再照合する。
- AC-WALK-04: Background 中も TrackPoint が継続し、通信可能なら API に届く。
- AC-WALK-06: 照合で Active Walk が無いとき端末は Failed を表示する。
- 通信復帰後、未送信 TrackPoint が Recording 中に自動再送される。
- 証跡は iPhone 実機 + ローカル Compose で `recording-ios-e2e-evidence` に従い残す。

## Gaps checked

- Release boundaries: 縦切り 7 はライフサイクル照合・Background 位置・通信復帰の実機受け入れを所有する。新機能 API や履歴一覧は対象外。
- Specification preconditions: Cognito、認証、API クライアント、永続キュー、位置権限、Compose、worker は main 導入済み。
- Implementation evidence: 照合と background 位置の骨格は main にある。実機 LAN 接続と縦切り 7 の E2E 証跡、発見ギャップの修正が残作業。
- Product contract presentation: 画面は `device-verification-spec-mockups.html`。新規 HTTP API HTML は不要（既存エンドポイントのみ）。ユーザー承認済み（2026-09-06）。

## Product contract presentation

- Screen: `device-verification-spec-mockups.html`（起動復元、Foreground、タブ移動、Background、Active 消失、通信復帰）
- HTTP API: 新規なし（`GET /v1/walks/active`、`POST .../track-points`、必要時 `DELETE /v1/walks/:walkId`）
- Approved: 2026-09-06
