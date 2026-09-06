# Finish 設計

> WHAT → HOW → WHY

## WHAT

R1 Step 5 の Finish を提供する。Owner は Recording 中に Finish し、端末の未送信 TrackPoint を吐き出したあと、API が受理済み点の DynamoDB 確定を待って Completed にする。

| 提供 | 内容 |
| --- | --- |
| 未送信吐き出し | モバイルは Finish 前に outbound queue を空にする。残件があるあいだは `POST /finish` しない |
| 確定待ち | `POST /v1/walks/:walkId/finish` は、その Walk の PostgreSQL 受理済み `recordedAt` がすべて DynamoDB に揃うまで最大 30秒待つ |
| 0件 | TrackPoint 0件は待ちなしで Completed。距離は 0 |
| 完了 | 揃ったあと Completed Walk を返す。`distanceMeters` は 0、`paceSecondsPerMeter` は `null` |
| 再試行 | 確定待ちの再試行可能な失敗は 503 `SERVICE_UNAVAILABLE`。Walk は `recording` のまま。モバイルは Recording を維持し、同じ Finish を Retry する |

受け入れ:

| 対象 | 入力 | 結果 |
| --- | --- | --- |
| Finish 成功 | 有効 token、`recording` Walk、受理済み点が DynamoDB に揃っている（または 0件） | 200 Completed Walk |
| Finish 待ち失敗 | 30秒以内に DynamoDB が揃わない、または一時障害 | 503 `SERVICE_UNAVAILABLE`、`retryable: true`。Walk は `recording` |
| not recording | `completed` / `failed` | 409 `WALK_NOT_RECORDING` |
| missing walk | 別 Owner または存在しない `walkId` | 404 `NOT_FOUND` |
| unauthenticated | Authorization 欠如または不正 | 401 `UNAUTHENTICATED` |
| idempotency | 同一 Key・同一 body の再送 | 完了済みなら 200 Completed。処理中なら確定まで待ち同じ結果 |
| worker | 重複・順不同・再配信 | Finish は受理済み点が DynamoDB に揃うまで Completed にしない |
| モバイル | Finish 失敗 | Recording 維持、同じ `Idempotency-Key` で Retry |

画面契約: `finish-spec-mockups.html`。API 契約: `finish-api-spec.html`。

Event、距離 / pace の経路由来値、Walk Detail、起動 / Foreground / タブ移動の実機検証は後続である。

## HOW

### 流れ

```text
モバイル: pause → flush outbound queue → POST /finish
API finishWalk:
  Owner 解決
  PG から recording Walk の受理済み recordedAt を読む
  0件 → すぐ walks.finish → 200 Completed
  1件以上 → ConfirmedTrackPoints で walkId Query を繰り返し
            受理集合 ⊆ DynamoDB 集合になるまで最大 30秒
            揃ったら walks.finish → 200 Completed
            揃わなければ recording のまま 503 SERVICE_UNAVAILABLE
```

Walk 状態は確定完了まで `recording`。新しい中間状態は作らない。

### API

```text
BearerAuth middleware
  → principal.cognitoSubject
POST /v1/walks/:walkId/finish
  → body {} と Idempotency-Key を検証
  → OwnerRepository.resolveByCognitoSubject
  → 受理済み recordedAt を読む
  → ConfirmedTrackPoints.listRecordedAt(walkId) を上限 30秒まで繰り返す
  → WalkRepository.finish
  → 200 Completed  /  503 SERVICE_UNAVAILABLE
```

| 部品 | 役割 |
| --- | --- |
| `ConfirmedTrackPoints` | DynamoDB `Query(walkId)` → `recordedAt[]`。adapter は infrastructure |
| `WalkRepository` | 受理済み `recordedAt` 一覧と `finish` |
| `finishWalk` | 待ち → `finish`。待ち失敗は `service_unavailable`。clock / sleep は注入 |
| OpenAPI / route | 503 `SERVICE_UNAVAILABLE` / `retryable: true` |
| 設定 | 待ち上限 30秒。ポーリング間隔は実装ローカル（例: 200ms） |

### モバイル

```text
onFinishPress
  → pause sampling
  → flush outbound queue
  → 残件あり → Finish 失敗（Recording + Retry）
  → POST /finish（同一 Idempotency-Key）
  → 200 → Completed（距離 0）
  → 503 / その他失敗 → Recording 維持 + Retry
```

画面状態は増やさない。503 の `message` を Finish 失敗表示に使う。

### 検証

- use case: 0件即完了、揃ったら完了、30秒で 503、同一 Key 再送
- worker / DynamoDB: 重複・順不同でも finish が揃うまで待つ
- route: 503 envelope
- モバイル: finish 503 で Recording + Retry

## WHY

受理済み点の DynamoDB 確定を Finish の成功条件にすると、Completed のあとに経路点が欠ける状態を避けられる。待ちを `POST /finish` 内に置くと、承認済み契約どおり Completed をその応答で返せる。Walk を `recording` のまま失敗させると、既存の Finish Retry と Active Walk 一意性を保てる。30秒は SQS → worker の通常遅延を吸収し、それ以上は手動 Retry に任せる。
