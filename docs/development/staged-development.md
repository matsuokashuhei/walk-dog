# walk / dog 段階開発計画

> **For agentic workers:** 実装時はリリース単位でタスクを分解し、各リリースの受け入れ条件を満たしてから次のリリースへ進める。

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

## 進捗状況

- R0は進行中で、最初の作業単位としてAPI基盤を進める。
- API品質ゲートはローカル（`npm run check`）と GitHub Actions（PR / publish → reusable `api-check` で lint / jscpd / knip / typecheck 並列）まで導入済み。残作業: [2026-08-02-r0-api-quality-gate-follow-ups.md](./2026-08-02-r0-api-quality-gate-follow-ups.md)

## R0: 開発基盤

- OpenAPI、Honoを使うNode.js API、PostgreSQL migration、Docker開発環境、ECR公開ワークフローを整備する。
- Cognitoトークン検証、S3、SQS、DynamoDBの環境別接続設定を定義する。
- Sentry、相関ID付き構造化ログ、APIとワーカーのヘルスチェックを導入する。
- モバイルに認証状態、APIクライアント、永続送信キュー、iOS位置情報権限を組み込む。

## R1: 散歩記録の縦切り

- Sign Up、Sign In、OTP確認、Owner表示名登録、Sign Outを実装する。
- Dog一覧、Dog登録、Dog選択を実装し、Dog登録時にDaily 30分のGoal Revisionを作成する。
- Ready、Starting、Recording、Completed、Failedを、APIのActive Walkと同期して表示する。
- 10秒ごとのTrackPointを連番付きで送信し、SQSワーカーがDynamoDBへ保存する。
- Finishは受理済み連番までのTrackPoint処理が確定した後にCompletedへ遷移する。
- Participant別のPee、Poop、Sniff、Greet、同一eventIdでの手動Retry、Walk Detailの地図、距離、時間、Eventを実装する。
- 起動、Foreground復帰、タブ移動時にActive Walkを照合し、バックグラウンド位置記録をiPhone実機で検証する。

## R2: 振り返りとDog管理

- Completed Walkの履歴、20件単位のoffsetページング、Dog別履歴、Walk Detailを提供する。
- Dog編集、Avatarアップロード、Goal Revisionの追加、DogごとのDaily / Weekly Goal Progressを提供する。
- Owner Contribution、週間集計、複数Dog WalkのDog別時間加算を提供する。
- Loading、Empty、Error、Cached Update Error、Not Found、Contract Errorを読み取り画面で表示する。

## R3: 設定と公開準備

- Owner編集、Preferences、Email Change、利用規約、プライバシーポリシー、アプリ情報を提供する。
- 日本語・英語、km・mile、Light・Dark・System、通知設定を画面表示へ反映する。
- Dynamic Type、Reduce Motion、テキスト・ラベル・アイコンによる状態表現を実機で確認する。
- 公開用の法務文書URL、データ保持と削除、配布範囲、審査対応を公開リリースの要件として確定する。

## 公開インターフェース

- `/v1` 配下に認証、Owner、Dog、Goal、Walk、TrackPoint、Event、History、Contribution、Preference APIを段階ごとに追加する。
- `Idempotency-Key` はWalk開始、Finish、Goal追加で使用する。
- `eventId` はEventの冪等キー、`sequence` はWalk内のTrackPoint送信順序を表す。
- PostgreSQLはOwner、Dog、Goal Revision、Walk、Participant、Event、Preferenceを扱い、DynamoDBはTrackPointを扱う。

## 検証

- OpenAPI契約テストで成功、認証、入力不正、競合、再試行可能エラーを確認する。
- API統合テストでOwner境界、Dog名一意性、Goal Revision、Active Walk一意性、Event冪等性、Completed集計を確認する。
- SQSワーカーテストで重複、順不同、再配信、Finish時の連番確定を確認する。
- モバイルテストで認証遷移、入力保持、Active Walk復元、失敗時Retry、単位・言語表示を確認する。
- iPhone実機でforegroundとbackgroundの位置情報、通信復帰、位置情報許可変更、完了後の経路表示を確認する。

## リリース開始時に確定する判断

- R1開始時: TrackPoint自動再試行の回数と時間上限。
- R3開始時: 利用者向けのWalk・Owner削除、データ保持期間、既存法務文書の公開URL。
- Android開始時: 地図、位置情報権限、省電力動作の受け入れ条件。
