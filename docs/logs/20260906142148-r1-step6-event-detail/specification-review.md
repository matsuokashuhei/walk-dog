# Specification review

- status: ready
- Purpose: R1 Step 6 の Event + Detail（Pee / Poop / Sniff / Greet、eventId Retry、Walk Detail の経路・距離・時間・Event）
- Active release: R1
- next permitted action: plan 実行方法の選択（subagent-driven / inline）

## Sources

1. `docs/development/staged-development.md`
   - アクティブリリースは R1。開発焦点は散歩記録の縦切り。
   - R1 縦切り 6 は Event + Detail。Participant 別の Pee / Poop / Sniff / Greet、同一 `eventId` での手動 Retry、Walk Detail の経路・距離・時間・Event。
   - Recording 中の距離と pace は端末が保持する TrackPoint から表示する。Finish と Walk Detail の距離・pace は DynamoDB 確定 TrackPoint の経路長から算出する。
   - Finish 成功後の Completed から `/walks/:walkId` へ遷移する。履歴一覧は R2。
   - 公開インターフェースに `POST /v1/walks/:walkId/events` と `GET /v1/walks/:walkId` を追加し、Finish の距離・pace を経路由来値へ更新した。
2. `docs/specs/external-specification.html`
   - Recording は経過時間、距離、pace、Participant、Event 操作を表示する。
   - Event は Pee / Poop / Sniff / Greet。失敗時は「記録に失敗しました」と手動 Retry。
   - Finish 成功後に Completed とし、Walk Detail へ遷移する。
   - `POST /walks/:walkId/events` と `GET /walks/:walkId`。
   - Event 0件は空状態。TrackPoint 0件の距離は 0。
3. `docs/logs/20260906122123-r1-step5-finish/specification-review.md`
   - Event、距離 / pace の経路由来値、Walk Detail は縦切り 6 へ Deferred。
4. Current implementation (`origin/main` @ `7bc8224`)
   - Event テーブル / Event API / Walk Detail / 距離算出は未導入。

## Current release deliverables

1. Recording 中に Participant 別の Pee / Poop / Sniff / Greet を送り、失敗時は同じ `eventId` で手動 Retry できる。
2. `POST /v1/walks/:walkId/events` が Recording 中の Event を受理し、冪等に返す。
3. Recording は端末点から距離・pace を表示する。
4. Finish 成功後に Completed から Walk Detail へ進み、経路・距離・時間・Event を表示する。
5. `GET /v1/walks/:walkId` が Completed Walk Detail を返す。
6. Finish / Detail の `distanceMeters` / `paceSecondsPerMeter` は DynamoDB 確定経路から算出する。0件は距離 0・pace `null`。
7. 直前前提として PostgreSQL の Event schema / migration を入れる。

## Decisions

- Plan-level (confirmed): Finish / Walk Detail は DynamoDB 確定 TrackPoint 経路から距離・pace を算出し、Recording 中は端末が保持する点から表示する。計画書へ同期済み。
- Plan-level (confirmed): Completed から `/walks/:walkId` へ遷移する。履歴一覧（`GET /walks` offset）は R2。計画書へ同期済み。
- Implementation-local (proposed): Event は端末の永続送信キューへ載せ、手動 Retry は同一 payload を再送する。
- Deferred: Completed Walk 履歴一覧、Dog 別履歴、Goal progress、Owner タブ、Photo、起動 / Foreground / タブ移動の実機検証（縦切り 7）、Avatar / S3。
- Out of plan: なし。

## Verification conditions

- Recording 中の有効 Event 送信は Participant に紐付く Event を返す。
- 同一 `eventId`・同一内容の Retry は冪等成功。内容違いは 409。
- Event 送信失敗時は「記録に失敗しました」と手動 Retry。
- Finish 200 の `distanceMeters` / `paceSecondsPerMeter` は確定経路から算出される。
- `GET /v1/walks/:walkId` は自 Owner の Completed Walk Detail を返す。Event 0件は空状態、TrackPoint 0件は距離 0。
- 別 Owner または存在しない `walkId` は 404 `NOT_FOUND`。
- `recording` ではない Walk への Event は 409 `WALK_NOT_RECORDING`。
- Access Token 欠如または不正は 401 `UNAUTHENTICATED`。

## Gaps checked

- Release boundaries: 縦切り 6 は Event・距離・Walk Detail を所有する。履歴一覧は R2。実機ライフサイクルは縦切り 7。
- Specification preconditions: Event schema は未導入（必須）。その他の前提は main 導入済み。
- Implementation evidence: Event API / Detail / 距離算出 / Event キューは未実装。
- Product contract presentation: 画面は `event-spec-mockups.html`。HTTP API は `event-api-spec.html`。ユーザー承認済み（2026-09-06）。

## Product contract presentation

- Screen: presented in `event-spec-mockups.html` (Recording Event、Retry、Completed、Walk Detail、Event 空)
- HTTP API: presented in `event-api-spec.html` (`POST /events`、`GET /walks/:walkId`、Finish 距離・pace)
- Approved: 2026-09-06
