# Specification review

- status: ready
- Purpose: R1 Step 3 の Active Walk（Ready → Starting → Recording → Completed / Failed）を API とモバイルで同期して表示する
- Active release: R1
- next permitted action: design

## Sources

1. `docs/development/staged-development.md`
   - アクティブリリースは R1。開発焦点は散歩記録の縦切り。
   - R1 縦切り 3 は Active Walk。Ready → Starting → Recording → Completed / Failed を API と同期する。
   - Walk Ready は同じ Owner の Dog を1頭以上選択して開始する。
   - このステップの必須前提: PostgreSQL schema（Walk / Participant）、Cognito（API側トークン検証）、モバイル認証状態、モバイル API クライアント、iOS 位置情報権限（foreground / background）。
   - TrackPoint 送信は縦切り 4。Finish の受理済み連番確定は縦切り 5。Event と Walk Detail（地図・距離・時間・Event）は縦切り 6。起動 / Foreground 復帰 / タブ移動の実機検証は縦切り 7。
   - `Idempotency-Key` は Walk 開始と Finish で使用する。
   - 公開インターフェースは `/v1` 配下に Walk API を段階ごとに追加する。
2. `docs/specs/external-specification.html`
   - Walk 画面は `/(tabs)/walk`。Ready の Start は、同じ Owner の Dog を1頭以上選択し、foreground・background 位置情報を許可し、開始条件を満たした場合に有効。不足条件は理由を表示する。
   - Starting は開始要求中。API 開始失敗時は Ready へ戻り、理由と手動 Retry を表示する。
   - Recording は Background 中も Walk を継続する。Finish 失敗時は Recording を維持し、手動 Retry を可能にする。
   - Finish 成功時は Completed。再送・同期不能、位置情報許可取り消し、API 上の Active Walk 消失時は Failed として破棄する。
   - 起動、Sign In、Foreground 復帰、タブ移動時は API 上の Active Walk を照会する。`recording` は Recording、`starting` は Starting として復元する。
   - `GET /walks/active` は Active Walk または 204。`POST /walks` は `{ participantDogIds }` と `Idempotency-Key` を受け、Walk（starting / recording）を返す。`POST /walks/:walkId/finish` は `Idempotency-Key` を受け、Completed Walk を返す。
   - API 状態は starting / recording / completed / failed。Ready は画面状態。1 Owner につき Active Walk は最大1件。
   - TrackPoint が 0件でも Completed Walk は距離 0 で成立する。History・Goal progress・Contribution は Completed Walk をデータソースとする。
   - Event、経路地図、距離、pace、Walk Detail、TrackPoint 送信は製品契約にあるが、計画書では後続縦切り。位置情報許可時の Walk 画面背景と現在地は、このセッションで扱う。
3. `docs/specs/mobile-journey-wireflow.html`
   - WALK-01 Ready は current Dogs を選択して開始する。WALK-02 Starting、WALK-03 Recording。
   - Photo Capture、Interrupted、today progress、Me タブは製品契約または計画書のこのステップに無い。
4. `docs/logs/20260814213159-r1-step2-dog/specification-review.md`
   - Walk Ready の Dog 選択、開始、記録は縦切り 3。
   - タブ（Walk / Me）は Step 2 では後続。
5. Current implementation
   - 認証済みホームは Dogs List（`apps/mobile/src/app/(app)/index.tsx`）。Walk route とタブは無い。
   - PostgreSQL schema は `owners`、`dogs`、`goal_revisions`。Walk / Participant の table は無い。
   - `ActiveWalkCommands.failIfPresent` は no-op（`createAbsentActiveWalkCommands`）。モバイル `hasActiveWalk()` は常に `false`。
   - 位置情報権限（`expo-location` / Info.plist）は未導入。
   - Cognito トークン検証、モバイル認証状態、Dogs API クライアントは導入済み。

## Current release deliverables

1. `GET /v1/walks/active` は Access Token で認証し、その Owner の Active Walk を返す。無いときは 204。
2. `POST /v1/walks` は Access Token で認証し、同一 Owner の Dog を1頭以上指定して Active Walk を作る。
3. `POST /v1/walks/:walkId/finish` は Access Token で認証し、その Active Walk を Completed にする。
4. モバイルの Walk 画面は Ready / Starting / Recording / Completed / Failed を API の Active Walk と同期して表示する。
5. Start は Dog 選択と foreground / background 位置情報許可が揃ったときに有効。不足理由を表示する。
6. 位置情報を許可している Walk 画面は、背景を Apple MapKit の地図にし、端末の現在地を表示する。未許可のときは地図と現在地を出さない。
7. Sign Out の `failIfPresent` は実在する Active Walk を Failed にする。

## Decisions

- Plan-level (confirmed): このセッションの画面は Walk の Ready / Starting / Recording / Completed / Failed。認証済みシェルに Dogs と Walk のタブを置く。Owner / Me タブ、Walk Detail、Event、Goal progress は後続。
- Plan-level (confirmed): 位置情報を許可している Walk 画面は Apple MapKit を背景にし、現在地を表示する。TrackPoint の経路と Walk Detail の地図は後続。
- Plan-level (confirmed): R1 の公開インターフェースに `GET /v1/walks/active`、`POST /v1/walks`、`POST /v1/walks/:walkId/finish` を追加する。TrackPoint / Event API はこのステップに含めない。
- Plan-level (confirmed): `POST /v1/walks` は開始条件を満たすと Active Walk を `recording` で返す。Starting は開始要求中の画面状態。API の `starting` 永続化は TrackPoint 縦切りで扱う。
- Plan-level (confirmed): このステップの Finish は受理済み連番を待たず Completed にする。TrackPoint 0件の Completed は距離 0。連番確定待ちは縦切り 5。
- Plan-level (confirmed): Walk 画面の表示時に `GET /v1/walks/active` で照合する。起動 / Foreground 復帰 / タブ移動の実機検証は縦切り 7。
- Implementation-local (proposed): Walk と Participant は `walks` module に置き、PostgreSQL へ `walks` と `walk_participants` を追加する。モバイルの HTTP 呼び出しは `lib/walk-api.ts` に置く。
- Implementation-local (proposed): iOS の地図は Apple MapKit。現在地は端末の位置情報で表示し、TrackPoint API には送らない。
- Implementation-local (proposed): Active Walk が既にある開始、および同一 `Idempotency-Key` で異なる body は `409`。エラー envelope は既存 API と同じ `code` / `message` / `requestId` / `retryable`。
- Deferred: TrackPoint 送信、Finish の連番確定、Event、経路地図、距離 / pace の経路由来値、Walk Detail、Goal progress、Owner タブ、起動 / Foreground / タブ移動の実機検証。
- Out of plan: wireflow の Photo Capture と Interrupted 状態。製品契約の Failed と Completed を使う。

## Verification conditions

- 有効な Access Token の `GET /v1/walks/active` は、Active Walk があるとき 200、無いとき 204 を返す。
- 有効な Access Token と、同一 Owner の Dog を1頭以上含む `POST /v1/walks` は 201 と `recording` の Walk を返す。
- 同一 Owner に Active Walk がある状態の `POST /v1/walks` は 409。
- Access Token 欠如または不正は 401 `UNAUTHENTICATED`。
- `participantDogIds` 欠如、空、別 Owner または存在しない `dogId` は 400 または 404。画面は Ready を維持し、理由と手動 Retry を表示する。
- 再試行可能な API 失敗は Ready に戻り、理由と手動 Retry を表示する。
- Recording 中の Finish 成功は Completed を表示する。Finish 失敗は Recording を維持し、同じ Finish を再試行する。
- 位置情報許可取り消し、または API 上の Active Walk 消失は Failed として破棄し、Ready へ戻る操作を表示する。
- Start は Dog 未選択、または foreground / background 位置情報未許可のとき無効で、不足理由を表示する。
- 位置情報許可時の Walk 画面は Apple MapKit を背景にし、現在地を表示する。未許可の画面は地図と現在地を出さない。
- Sign Out 承諾時は Active Walk を Failed にしてから session を無効化する。
- iOS E2E が Ready、Start 不足条件、Starting、Recording、Completed、Failed、Start 失敗 Retry を記録する。

## Gaps checked

- Release boundaries: Active Walk 縦切りが状態同期、開始、Finish、位置情報許可を所有する。TrackPoint / Event / Walk Detail / 実機ライフサイクル検証は後続。
- Specification preconditions: Cognito トークン検証、モバイル認証状態、モバイル API クライアントは導入済み。Walk / Participant schema と iOS 位置情報権限はこのステップ直前の必須前提で、未導入。
- Implementation evidence: Walk route は無い。`hasActiveWalk()` は常に false。`failIfPresent` は no-op。S3 / SQS / DynamoDB / 永続送信キューはこのステップの前提ではない。
- Product contract presentation: 画面は `walk-spec-mockups.html`、API は `walk-api-spec.html`。ユーザーが契約 HTML を承認した。計画レベルの判断は `docs/development/staged-development.md` へ同期済み。

## Product contract presentation

- Screen: presented in `walk-spec-mockups.html` (HTML mockups, components, events)
- HTTP API: presented in `walk-api-spec.html` (`GET /v1/walks/active`, `POST /v1/walks`, `POST /v1/walks/:walkId/finish` request, response, and behavior)
