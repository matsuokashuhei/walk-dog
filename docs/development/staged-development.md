# walk / dog 段階開発計画

> **For agentic workers:** 実装時はリリースの提供能力に沿ってタスクを分解する。R1 進行中は、未完了の R0 能力を必要な縦切りステップの直前に実装し、各ステップの受け入れ条件を満たしてから次のステップへ進める。

**Goal:** iOSの開発チーム向けビルドで、OwnerがDogを選び、バックグラウンドで散歩を記録し、完了した散歩を確認できる状態を提供する。

**Architecture:** ExpoモバイルアプリがOpenAPIから生成した型付きクライアントで、さくらVPS上のTypeScript / Node.js APIを利用する。APIはCognitoで認証し、業務データをPostgreSQL、TrackPointをSQS Standard経由でDynamoDB、AvatarをS3で扱う。

**Tech Stack:** Expo SDK 57、TypeScript、Node.js、PostgreSQL、AWS Cognito、S3、SQS Standard、DynamoDB、Apple MapKit、Sentry、Docker、AWS ECR。

## 承認済みの判断

- iOS先行で、開発チーム向け開発ビルドを配布する。
- モバイルAPIはさくらVPSで運用し、GitHub ActionsがDockerイメージをAWS ECRへ公開する。開発チームがVPSへイメージを反映する。
- OpenAPIをAPI契約の正本とし、サーバー検証、モバイルクライアント型、契約テストに利用する。
- TrackPointはモバイルがWalkごとの連番を付けて送信し、APIがSQS Standardへ受理する。ワーカーは連番と冪等性を使ってDynamoDBへ確定する。
- OwnerとDogのAvatarはモバイルからAPIへ送信し、APIがS3へ保存する。
- SentryとVPSコンテナの構造化ログで、モバイル、API、ワーカーの状態遷移を観測する。
- 利用規約とプライバシーポリシーは既存の公開文書を利用する。
- R0のAPI基盤はHonoで実装する。
- 開発焦点はR1（散歩記録の縦切り）とする。未完了のR0能力はR1各縦切りステップの直前に実装する。

## 進捗状況

- R1を進行中とする。未完了のR0能力は、下表の対応に従い必要な縦切りステップの直前に実装する。
- R0で導入済み: Hono API基盤、ローカルComposeのPostgreSQL、Drizzle client、API観測性（Pino / Sentry / requestId）、API静的品質ゲート（ローカル `npm run check` と GitHub Actions の reusable `api-check`）。品質ゲートの残作業: [2026-08-02-r0-api-quality-gate-follow-ups.md](./2026-08-02-r0-api-quality-gate-follow-ups.md)

## R1 縦切りと未完了 R0 前提

R1は次の縦切り順で進める。

表の値:

- **必須** … そのステップを成立させる前提
- **配布・VPS反映** … 開発チーム向けビルド配布と、VPSへのAPI反映の前提
- **ローカルAPI実機** … 実機がローカルCompose上のAPIへ接続して検証するときの前提
- **VPS API実機** … 実機がVPS上のAPIへ接続して検証するときの前提
- **—** … そのステップの成立前提ではない（後続ステップまたは別リリースで扱う）

| R1 縦切り | PostgreSQL schema / migration | Cognito（API側トークン検証） | モバイル認証状態 | モバイル API クライアント | 永続送信キュー | iOS 位置情報権限 | S3/SQS/DynamoDB 接続 | Compose（ElasticMQ / DynamoDB Local / S3互換） | worker骨格 + ヘルス | Docker / ECR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **1. アカウント**（Sign Up / Sign In / OTP / Owner 表示名 / Sign Out） | 必須（owners・表示名） | 必須 | 必須 | 必須 | — | — | — | — | — | 配布・VPS反映 |
| **2. Dog**（一覧・登録・プロフィール Detail、登録時 Daily 30分 Goal Revision） | 必須（Dog / Goal Revision） | 必須 | 必須 | 必須 | — | — | — | — | — | 配布・VPS反映 |
| **3. Active Walk**（Ready → Starting → Recording → Completed / Failed を API と同期。許可時は Apple MapKit で現在地） | 必須（Walk / Participant） | 必須 | 必須 | 必須 | — | 必須（foreground / background） | — | — | — | 配布・VPS反映 |
| **4. TrackPoint**（10秒ごと連番送信 → SQS → worker → DynamoDB） | — | 必須 | 必須 | 必須 | 必須 | 必須（取得元） | 必須（SQS / DynamoDB） | 必須 | 必須 | 配布・VPS反映 |
| **5. Finish**（受理済み連番の処理確定後に Completed） | — | 必須 | 必須 | 必須 | 必須（未送信の吐き出し） | 必須（記録継続） | 必須（SQS / DynamoDB） | 必須 | 必須 | 配布・VPS反映 |
| **6. Event + Detail**（Pee / Poop / Sniff / Greet、eventId Retry、経路・距離・時間・Event） | 必須（Event） | 必須 | 必須 | 必須 | 必須（Event Retry） | 必須（Event の latitude / longitude） | 必須（DynamoDB 経路） | 必須 | 必須 | 配布・VPS反映 |
| **7. 実機検証**（起動／Foreground 復帰／タブ移動での Active Walk 照合、バックグラウンド位置） | — | 必須 | 必須 | 必須 | 必須（通信復帰） | 必須（foreground / background） | VPS API実機 | ローカルAPI実機 | 必須 | VPS API実機 |

前提の意味:

- **モバイル認証状態** … Cognito セッションの保持・復元・access token 付与（認証の提供者は Cognito。端末内の認証状態管理とは別層）
- **モバイル API クライアント** … OpenAPI から生成した型付き client と共通エラー処理
- **永続送信キュー** … 端末内の送信待ち（SQS ではない。流れは 端末キュー → API → SQS → worker → DynamoDB）
- **iOS 位置情報権限** … foreground / background 許可と Start 条件・取得の土台。許可時の Walk 画面は Apple MapKit を背景にし、現在地を表示する。
- **Owner / Dog Avatar と S3** … Dog AvatarはR2（Dog編集・Avatarアップロード）、Owner AvatarはR3（Owner編集）の前提

## R0: 開発基盤

- OpenAPI、Honoを使うNode.js API、PostgreSQL migration、Docker開発環境、ECR公開ワークフローを整備する。
- Cognitoトークン検証、S3、SQS、DynamoDBの環境別接続設定を定義する。
- Sentry、相関ID付き構造化ログ、APIとワーカーのヘルスチェックを導入する。
- モバイルに認証状態、APIクライアント、永続送信キュー、iOS位置情報権限を組み込む。

## R1: 散歩記録の縦切り

- Sign Up、Sign In、OTP確認、Owner表示名登録、Sign Outを実装する。
- Owner表示名は認証直後は未設定でよい。未設定の認証済み Owner は `/owner/display-name` で登録し、成功後に認証済みホームへ進む。この画面から Settings の Sign Out へ進める。
- Sign Outは、Active Walkがある場合に確認ダイアログを表示し、承諾後にActive WalkをFailedにしてからCognito sessionを無効化する。Active Walkがない場合は確認なしでSign Outする。
- アカウント縦切りの Settings（`/settings`）は Sign Out と法務リンク（利用規約、プライバシーポリシー、アプリ情報）を提供する。
- 認証済みホームは Dogs List を表示する。Empty と追加操作から `/dogs/new` で Name と Gender を登録し、Birthday は任意とする。登録時に Daily 30分の Goal Revision を作成する。一覧の行から `/dogs/:dogId` で名前、Gender、Birthday、currentGoal を表示する。
- 認証済みシェルは Dogs と Walk のタブを置く。Walk 画面は `/(tabs)/walk` で Ready、Starting、Recording、Completed、Failed を API の Active Walk と同期して表示する。
- Walk Ready は同じ Owner の Dog を1頭以上選択し、foreground と background の位置情報を許可すると開始する。不足条件は理由を表示する。
- 位置情報を許可している Walk 画面は Apple MapKit を背景にし、現在地を表示する。未許可のときは地図と現在地を出さない。
- `POST /v1/walks` は開始成功時に `recording` を返す。Starting は開始要求中の画面状態。
- この縦切りの Finish は受理済み連番を待たず Completed にする。TrackPoint 0件の Completed は距離 0。連番確定待ちは縦切り 5。
- 10秒ごとのTrackPointを連番付きで送信し、SQSワーカーがDynamoDBへ保存する。
- Finishは受理済み連番までのTrackPoint処理が確定した後にCompletedへ遷移する。
- Participant別のPee、Poop、Sniff、Greet、同一eventIdでの手動Retry、Walk Detailの経路、距離、時間、Eventを実装する。
- 起動、Foreground復帰、タブ移動時にActive Walkを照合し、バックグラウンド位置記録をiPhone実機で検証する。

## R2: 振り返りとDog管理

- Completed Walkの履歴、20件単位のoffsetページング、Dog別履歴、Walk Detailを提供する。
- Dog編集、Avatarアップロード、Goal Revisionの追加、DogごとのDaily / Weekly Goal Progressを提供する。
- Owner Contribution、週間集計、複数Dog WalkのDog別時間加算を提供する。
- Loading、Empty、Error、Cached Update Error、Not Found、Contract Errorを読み取り画面で表示する。

## R3: 設定と公開準備

- Owner編集、Preferences、Email Changeを提供する。
- Settings の法務リンクは R1 アカウント縦切りで提供済みの公開文書入口を継続利用し、Preferences と Email Change を Settings に追加する。
- 日本語・英語、km・mile、Light・Dark・System、通知設定を画面表示へ反映する。
- Dynamic Type、Reduce Motion、テキスト・ラベル・アイコンによる状態表現を実機で確認する。
- 公開用の法務文書URL、データ保持と削除、配布範囲、審査対応を公開リリースの要件として確定する。

## 公開インターフェース

- `/v1` 配下に認証、Owner、Dog、Goal、Walk、TrackPoint、Event、History、Contribution、Preference APIを段階ごとに追加する。
- `GET /v1/owner` はAccess Tokenで認証し、現在のOwnerを返す。`displayName` は未設定時 `null`、設定後は保存した値。
- `PATCH /v1/owner` はAccess Tokenで認証し、`displayName` を受けてOwnerを返す。`displayName` は前後空白除去後 1〜100 文字。
- `POST /v1/auth/sign-out` はAccess Tokenで認証し、成功時に204を返す。Active Walkがある場合はFailedにしてからsessionを無効化する。
- `DELETE /v1/walks/:walkId` はAccess Tokenで認証し、その Owner の `recording` Walk を `failed` にして204を返す。すでに `failed` の再送も204。`completed` は 409 `WALK_NOT_RECORDING`。
- `GET /v1/dogs` はAccess Tokenで認証し、そのOwnerが管理するDogと各DogのcurrentGoalを返す。0件は空配列。
- `POST /v1/dogs` はAccess Tokenで認証し、`name` と `gender` を必須、`birthday` を任意として受け、DogとDaily 30分のGoal Revisionを返す。`name` は同一Owner内で一意、前後空白除去後 1〜100 文字。`gender` は `male` / `female` / `unknown`。`birthday` 省略時の精度は `unknown`。同一OwnerのName重複は 409 `DOG_NAME_DUPLICATE`。
- `GET /v1/dogs/:dogId` はAccess Tokenで認証し、そのOwnerが管理するDogとcurrentGoalを返す。別Ownerまたは存在しない `dogId` は 404 `NOT_FOUND`。
- `GET /v1/walks/active` はAccess Tokenで認証し、そのOwnerのActive Walkを返す。無いときは204。この縦切りの Active Walk の `state` は `recording`。`participants` は `walkParticipantId`、`dogId`、応答時点の `name`。
- `POST /v1/walks` はAccess Tokenで認証し、`participantDogIds` と `Idempotency-Key` を受け、`recording` のWalkを返す。`participantDogIds` は同一OwnerのDogを1頭以上、重複なし。既にActive Walkがあるときは 409 `ACTIVE_WALK_EXISTS`。同一Keyで異なるbodyは 409 `IDEMPOTENCY_CONFLICT`。別Ownerまたは存在しない `dogId` は 404 `NOT_FOUND`。
- `POST /v1/walks/:walkId/finish` はAccess Tokenで認証し、空のbody `{}` と `Idempotency-Key` を受け、Completed Walkを返す。`durationSeconds` は `startedAt` から `completedAt` までの秒。`distanceMeters` はこの縦切りでは 0。`paceSecondsPerMeter` は距離0のため `null`。`recording` ではないWalkは 409 `WALK_NOT_RECORDING`。別Ownerまたは存在しない `walkId` は 404 `NOT_FOUND`。
- `Idempotency-Key` はWalk開始、Finish、Goal追加で使用する。開始とFinishはEndpointごとに別名前空間。有効期間は処理開始から24時間。
- `eventId` はEventの冪等キー、`sequence` はWalk内のTrackPoint送信順序を表す。
- PostgreSQLはOwner、Dog、Goal Revision、Walk、Participant、Event、Preferenceを扱い、DynamoDBはTrackPointを扱う。

## 検証

- OpenAPI契約テストで成功、認証、入力不正、競合、再試行可能エラーを確認する。
- API統合テストでOwner境界、Dog名一意性、Goal Revision、Active Walk一意性、Event冪等性、Completed集計を確認する。
- SQSワーカーテストで重複、順不同、再配信、Finish時の連番確定を確認する。
- モバイルテストで認証遷移、Owner表示名登録、入力保持、Active Walk復元、失敗時Retry、単位・言語表示を確認する。
- iPhone実機でforegroundとbackgroundの位置情報、通信復帰、位置情報許可変更、完了後の経路表示を確認する。

## リリース開始時に確定する判断

- R1 TrackPointステップ着手時: TrackPoint自動再試行の回数と時間上限。
- R3開始時: 利用者向けのWalk・Owner削除、データ保持期間、既存法務文書の公開URL。
- Android開始時: 地図、位置情報権限、省電力動作の受け入れ条件。
