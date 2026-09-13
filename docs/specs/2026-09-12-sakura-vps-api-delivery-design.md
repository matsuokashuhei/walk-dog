# さくら VPS API 提供経路 設計

## 目的

開発チームは、main で公開した Docker image の `latest` タグをさくら VPS 上の API と worker に載せて同じ版で稼働させる。モバイルは、その VPS 上の API を利用する。

本設計は [Hono API R0 設計](./2026-07-26-hono-api-r0-design.md) の継続的提供と [段階開発計画](../development/staged-development.md) の「GHA → ECR → VPS 反映」を、実装可能な契約として固定する。

## 方針

本番向け image、ECR 公開、VPS Compose、`latest` タグによる反映手順を一つの提供経路として揃える。手動だけの一時起動や、ECR なしの暫定経路は採用しない。

## 実行構成（VPS）

さくら VPS が API の実行ホストである。Docker Compose が次の unit を提供する。

- `postgres`。業務データの正本。volume で永続化する。
- `migrate`。release image と同じ image の one-shot container。`npm run migrate`（Drizzle）を実行して終了する。
- `api`。`node --import ./dist/instrument.js dist/server.js`。公開 HTTP。既定ポートは 3000。
- `worker`。同じ image、別 command で `dist/worker.js`。SQS を消費する。自己 health を `WORKER_HEALTH_PORT`（Compose では 3001）で提供する。

Cognito、S3、SQS、DynamoDB は AWS の標準 endpoint を使う。VPS Compose は ElasticMQ、DynamoDB Local、S3 互換サービスを持たない。VPS の環境設定は `SQS_ENDPOINT` と `DYNAMODB_ENDPOINT` を設定しない。

ホストは root 所有で読み取り権限を限定した環境設定ファイルを持つ。Compose はこのファイルから、共通 IAM identity の `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY`、および次の設定を `migrate` / `api` / `worker` へ渡す。

- `AWS_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_HOST` / `POSTGRES_PORT`
- `DATABASE_POOL_MAX`（任意。既定 10）
- `SQS_QUEUE_URL`
- `DYNAMODB_TABLE`
- `WORKER_HEALTH_URL` / `WORKER_HEALTH_PORT`
- `ENVIRONMENT` / `RELEASE`
- `SENTRY_DSN`（空のとき Sentry を使わない）

認証情報は Docker image、release manifest、構造化ログから分離する。

ready の定義は `GET /health` が PostgreSQL と worker health の両方に成功し、成功状態を返すことである。

## Docker image

`apps/api/Dockerfile` は multi-stage の release image を提供する。

- build stage は `npm ci` と `npm run build` を実行する。
- runtime stage は production 依存、`dist/`、`drizzle/`、起動に必要な `package.json` を持つ。
- 既定の起動は api の `npm start` である。
- `worker` と `migrate` は同じ image の command 上書きで起動する。
- runtime は `tsx watch` と test ソースを含まない。

ローカル開発用の `apps/compose.yml` は残す。開発時の `npm run dev` / `npm run worker` と、release image の起動は役割を分ける。

## ECR と publish

AWS ECR に API 用リポジトリを一つ置く。Terraform は `infra/aws` にリポジトリと、GitHub Actions が OIDC で assume する IAM role を追加する。role の権限は対象 ECR への push と digest 取得に限定する。workflow は長期の AWS access key を持たない。

`.github/workflows/publish.yml` は main への push で次を順に実行する。

1. 既存の reusable `api-check` を完了する。
2. release Dockerfile で image を build する。
3. GitHub OIDC で AWS role を取得し、ECR へ push する。
4. commit SHA の tag と mutable な `latest` タグを付ける。
5. release manifest を提供する。manifest は commit SHA、image digest（`sha256:…`）、OpenAPI の版を特定できる値、ビルド時刻を持つ。

Sentry の release 名と container の `RELEASE` は commit SHA を使う。

VPS 反映の参照は `latest` タグである。image digest は成功後の状態記録と差し戻しに使う。commit SHA tag は人が追うためのエイリアスである。

PR ごとの image publish は行わない。main の publish が release の入口である。

## VPS 反映

### ホスト上の成果物

- リポジトリ同梱の VPS 用 Compose（`postgres` / `migrate` / `api` / `worker`）
- root 所有の環境設定ファイル
- 現在稼働中の digest と、直前に成功した digest を記録する状態

ECR pull 用の AWS 認証は、publish 用 OIDC role とは別の identity を使う。

### 反映手順

開発チームは ECR の `latest` を pull する。

1. `latest` の image を pull する。
2. 同じ image で `migrate` one-shot を実行する。成功条件は exit 0 と、適用した migration version の構造化ログである。
3. migrate 成功後に `api` をその image へ更新して起動する。
4. 続けて `worker` を同じ image へ更新する。
5. `GET /health` が成功状態になることを確認する。
6. 成功したら、いま動かしている image digest を「現在 digest」にし、以前の現在値を「直前成功 digest」へ移す。

migrate は、既存の api と worker が読める schema 状態を提供する。破壊的な schema 変更は本提供経路の外で別設計する。

初回実装では人が SSH（または同等）で手順を実行する。GitHub Actions から VPS を直接更新する CD は持たない。

リポジトリは短い how-to を置く。pull、migrate、api、worker、health、rollback、状態記録の更新を順序どおりに書く。

### 失敗時

migrate が非ゼロで終了した場合、失敗した migration version、error、request ID、image digest を構造化ログと Sentry event へ記録する。稼働中の api と worker は現在の稼働版のままにする。修正を含む新しい image を publish し、新しい `latest` で反映を最初からやり直す。

api または worker 更新後に health が ready にならない場合、新 container を止め、直前成功 digest で api、続けて worker を戻す。すでに適用済みの migration を自動で戻す仕組みは持たない。rollback の主操作は image の差し戻しである。

## ホスト準備（一度だけ）

次は VPS 側の前提である。リポジトリは手順を書く。パネル操作そのものはコード化しない。

- Docker Engine と Compose plugin
- ECR pull 用の AWS 認証
- root 所有環境設定ファイルの配置と権限
- Postgres データ用 volume の置き場
- API ポート（初回は 3000）を必要な送信元だけに開けるファイアウォール設定

## 本設計の範囲外

- TLS 終端、reverse proxy、カスタムドメインの DNS 切り替え
- GitHub Actions から VPS への自動 promote
- migration の自動 down / 自動 schema rollback
- PR preview 環境と PR image publish
- ローカル `apps/compose.yml` の廃止
- Cognito / SQS / DynamoDB / S3 資源そのものの新規設計（接続先は既存 AWS 資源を環境設定で指す）

## 成功条件

1. main への push のあと、workflow が ECR に commit SHA と `latest` の tag 付き image を出し、manifest が digest と commit SHA を示す。
2. `latest` で VPS 上の migrate が成功し、api と worker が同じ image で動き、`GET /health` が成功状態を返す。
3. 意図した失敗（失敗する migrate、または health 非 ready）で、稼働中版が保持されるか、直前成功 digest へ戻せることを how-to どおりに確認できる。

## 検証

- Dockerfile の build と、container 内での `start` / `start:worker` / `migrate` の起動確認
- OIDC と ECR が揃ったあとの publish 実 push（`latest` 上書きを含む）
- VPS 実機での `latest` 反映が最終の受け入れ証明

## 関連

- [Hono API R0 設計](./2026-07-26-hono-api-r0-design.md)（継続的提供、VPS env、migration、health）
- [段階開発計画](../development/staged-development.md)（さくら VPS、ECR、配布・VPS 反映）
