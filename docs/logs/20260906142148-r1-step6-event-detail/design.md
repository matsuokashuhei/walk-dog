# Event + Detail 設計

> WHAT → HOW → WHY

## WHAT

R1 Step 6 の Event + Detail を提供する。Owner は Recording 中に Participant 別 Event を記録し、Finish 後の Walk Detail で経路・距離・時間・Event を確認する。

| 提供 | 内容 |
| --- | --- |
| Event 記録 | Pee / Poop / Sniff / Greet。`eventId` 冪等。失敗時は同一 payload で手動 Retry |
| Recording メトリクス | 端末が保持する TrackPoint から距離・pace を表示 |
| Finish 距離 | DynamoDB 確定点の経路長を算出し、Walk 行の `distanceMeters` に保存して Completed を返す |
| Walk Detail | Completed から `/walks/:walkId` へ。保存距離 + DynamoDB 経路 + PostgreSQL Event |
| 空状態 | Event 0件は「記録された Event はありません」。TrackPoint 0件は距離 0・pace `null` |

受け入れ:

| 対象 | 入力 | 結果 |
| --- | --- | --- |
| Event 新規 | 有効 token、`recording`、参加者、有効位置 | 201 Event |
| Event 再送 | 同一 `eventId`・同一内容 | 200 受理済み Event |
| Event 衝突 | 同一 `eventId`・内容違い | 409 `IDEMPOTENCY_CONFLICT` |
| Event not recording | `completed` / `failed` | 409 `WALK_NOT_RECORDING` |
| Event 非参加者 / 別 Owner | 不正な dog / walk | 404 `NOT_FOUND` |
| Finish 距離 | 確定点が揃ったあと | 200。`distanceMeters` は経路長（0件は 0） |
| Detail 成功 | 自 Owner の Completed | 200。経路・メトリクス・Event |
| Detail 空 Event | Event なし Completed | `events: []`、画面は空状態文言 |
| Detail 対象外 | 別 Owner、未完了、存在しない | 404 `NOT_FOUND` |
| モバイル Event 失敗 | 再試行可能な送信失敗 | 「記録に失敗しました」+ 手動 Retry |

画面契約: `event-spec-mockups.html`。API 契約: `event-api-spec.html`。

履歴一覧（`GET /walks` offset）、Photo、起動 / Foreground / タブ移動の実機検証は後続である。

## HOW

### モジュール

Event / Detail / 距離は既存の `walks` モジュールに追加する。TrackPoint と同じ「Walk に対する操作」境界を維持する。

### 流れ

```text
Recording Event:
  モバイル: eventId / occurredAt / 位置を固定 → Event キューへ載せる → POST /events
  API recordEvent:
    Owner 解決 → recording Walk 確認 → participantDogId が参加者か確認
    同一 eventId・同一内容 → 200 受理済み
    同一 eventId・内容違い → 409
    新規 → PostgreSQL に保存 → 201

Finish（距離追加）:
  既存どおり flush → 確定待ち
  揃ったら DynamoDB 点を recordedAt 順に結んで distanceMeters を算出
  Walk 行に distanceMeters を保存して completed
  pace = distance > 0 ? duration / distance : null

Walk Detail:
  GET /walks/:walkId
  completed + 自 Owner のみ
  保存済み distanceMeters / duration / pace
  + DynamoDB 経路点
  + PostgreSQL Event 一覧（occurredAt 順）
```

Walk 状態は増やさない。Event は `recording` のときだけ受け付ける。

### API

```text
BearerAuth middleware
  → principal.cognitoSubject

POST /v1/walks/:walkId/events
  → body 検証（eventId, participantDogId, type, occurredAt, latitude, longitude）
  → OwnerRepository.resolveByCognitoSubject
  → recordEvent
  → 201 / 200 Event  /  409 / 404 / 401 / 400

GET /v1/walks/:walkId
  → Owner 解決
  → getWalkDetail（PG Walk + Events、DynamoDB trackPoints）
  → 200 Detail  /  404

POST /v1/walks/:walkId/finish
  → 既存の確定待ち
  → ConfirmedTrackPoints の座標を読み pathDistanceMeters
  → walks.finish(distanceMeters)
  → 200 Completed（距離・pace 付き）
```

| 部品 | 役割 |
| --- | --- |
| Event schema / migration | `walk_events`（eventId PK、walkId、participantDogId、type、occurredAt、lat/lng）。`walks.distance_meters` 列を追加 |
| `recordEvent` | recording 確認、参加者確認、eventId 冪等 |
| `pathDistanceMeters` | 点列（lat/lng）→ 整数メートル。純関数 |
| `finishWalk` 拡張 | 確定待ち後に DynamoDB 点を読み、距離を保存 |
| `getWalkDetail` | completed + 自 Owner。保存距離 + 経路 + Event |
| OpenAPI / routes | `POST .../events`、`GET .../:walkId`。Finish の `distanceMeters` を整数へ |
| `ConfirmedTrackPoints` | 既存の recordedAt 一覧に加え、Detail / 距離用に lat/lng 付き点列を返す |

`type` は `pee` / `poop` / `sniff` / `greet`。経路長は連続点の大円距離（メートル）を合計し、整数へ丸める。

### モバイル

```text
Recording
  → 端末 path から距離・pace を表示（pathDistanceMeters 相当）
  → Participant ごとに Pee / Poop / Sniff / Greet
  → onEventPress: eventId・occurredAt・位置を固定し walk-event-queue へ
  → 成功: 失敗表示を消す
  → 再試行可能失敗: 「記録に失敗しました」+ 同一 payload で Retry

Completed
  → Finish 応答の duration / distance / pace を表示
  → Walk Detail を見る → /walks/[walkId]

Walk Detail
  → GET /v1/walks/:walkId
  → 地図に確定経路、メトリクス、Event 一覧
  → events 空なら空状態文言
```

`walk-event-queue` は TrackPoint 用キューとは別実装。永続化と同一 payload の手動 Retry パターンは揃える。Finish 前の TrackPoint flush は既存どおり。Event の未送信は Finish 成功条件に含めない（契約どおり Event は送信成功時に記録。Retry は手動）。

### 検証

- use case: Event 201/200/409、非参加者 404、Finish 距離保存、Detail 経路・Event 空
- route / OpenAPI: 新 endpoint と Finish `distanceMeters` 整数
- モバイル: Event Retry、Recording 距離、Completed → Detail
- iOS E2E: Recording Event、Retry、Completed 距離、Detail（Event あり / 空）

## WHY

Event・Detail・距離はすべて `/v1/walks/...` の操作であり、TrackPoint と同じ `walks` 境界に置くと Owner / recording / Participant の検証を共有できる。距離を Finish 時に Walk 行へ保存すると、Finish 応答と Detail のメトリクスが一致し、Detail のたびに経路長を再計算しなくてよい。経路そのものは DynamoDB を正本のまま返す。Event キューを TrackPoint と分けると、自動再送（TrackPoint）と手動 Retry（Event）の契約差を混ぜずに実装できる。
