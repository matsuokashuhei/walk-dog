# Hono API R0 設計

## 目的

R0は、walk / dogのモバイルアプリが認証済みAPIを利用するための実行基盤を提供する。

## 構成

- `apps/api`はNode.js LTS上で実行する独立したnpm packageである。
- HTTP APIはHonoと`@hono/zod-openapi`で提供する。
- APIは`/v1`配下にリソース単位のroute moduleを登録する。
- API仕様は`GET /openapi.json`でJSONとして提供する。
- OpenAPI schemaは入力検証、レスポンス検証、モバイル型付きclient生成のデータソースである。
- `api`と`worker`は同一Docker imageから、それぞれ専用のcontainerとして起動する。API containerはHTTP requestを処理し、worker containerはbackground jobを処理する。

## HTTP API

### 認証

`/v1`は公開endpointと認証済みendpointを提供する。認証済みendpointはCognito access tokenを受け付ける。APIは`aws-jwt-verify`で署名、期限、issuer、User Pool、app client、`token_use`を検証し、tokenの`sub`を認証済みOwnerの`cognito_subject`として扱う。

`cognito_subject`はOwnerごとに一意であり、認証済みOwnerは自身のresourceを操作する。

OpenAPIは`components.securitySchemes`に`type: http`、`scheme: bearer`、`bearerFormat: JWT`の`BearerAuth`を定義する。認証済みrouteは`security: [{ BearerAuth: [] }]`を持ち、認証middlewareがhandlerより前にCognito access tokenを検証する。公開routeはsecurity requirementを持たず、Bearer tokenなしで利用する。`/openapi.json`と`/health`は公開endpointである。

### APIレスポンス

正常レスポンスはOpenAPI response schemaに一致するJSONを返す。失敗レスポンスは次のJSONを返す。

```json
{
  "code": "string",
  "message": "string",
  "requestId": "string",
  "retryable": true
}
```

`requestId`はrequestごとに生成または受理され、レスポンス、ログ、Sentry eventを関連付ける。入力値、認証、依存サービス、競合の各状態はHTTP status、`code`、`message`、`retryable`で表現する。クライアントは`retryable`がtrueの状態で再試行操作を提供する。

access tokenが必要なrouteは、token未指定、期限切れ、署名、issuer、User Pool、App Client、`token_use`の各認証状態にHTTP 401を返す。responseは`code: "UNAUTHENTICATED"`、`message: "Authentication is required."`、`requestId`、`retryable: false`を持つ。

### ヘルスチェック

`GET /health`はAPI process、worker process、PostgreSQLの稼働状態を確認する。三つの状態が稼働中の場合にHTTP 200とsuccess状態を返す。worker processはDocker network内の`/health`で自身の稼働状態をAPIへ提供する。いずれかの状態が再試行可能な接続状態の場合、`GET /health`はHTTP 503と`code: "DEPENDENCY_UNAVAILABLE"`、`requestId`、`retryable: true`を持つresponseを返す。

## PostgreSQL

業務データはPostgreSQLで扱う。Drizzle ORMのTypeScript schemaをreview対象のSQL migrationとして生成し、migration commandが順序どおりに適用する。

API containerとworker containerは、それぞれ一つの`pg.Pool`を作成してDrizzle clientへ渡す。`DATABASE_POOL_MAX`はPoolの接続上限を表し、既定値は10である。終了処理はPoolをcloseし、処理済みconnectionをPostgreSQLへ返す。

Drizzleは適用済みmigrationのversion、hash、適用時刻をPostgreSQLに記録する。VPS反映前に、開発チームがrelease manifestのimage digestを指定してone-shot migration containerを実行する。`npm run migrate`は専用のPostgreSQL sessionで`walk_dog_schema_migration`用のadvisory lockを取得し、そのsessionでDrizzle migrationを実行する。適用したmigration versionを構造化ログへ出力し、session終了時にlockを解放する。

複数tableを更新する操作は`db.transaction()`で一つの業務状態遷移として確定する。DB rowはAPI DTOへ変換してresponse schemaに一致するJSONを返す。

R0 migrationは`owners` tableを提供する。`owners`は内部Owner ID、Cognito `sub`を保持する`cognito_subject`、作成日時、更新日時を持ち、`cognito_subject`の一意性を提供する。

## AWS連携

R0はAWS SDK for JavaScript v3の個別clientと、S3、SQS、DynamoDBへの環境別接続設定を提供する。APIとworkerは起動時に設定を検証し、ready状態で依存サービスへの接続状態を提供する。

開発環境とCIは`S3_ENDPOINT`、`SQS_ENDPOINT`、`DYNAMODB_ENDPOINT`でComposeのAWS互換serviceへ接続する。VPSは`AWS_REGION`を使い、AWS SDK v3が各AWS serviceの標準endpointへ接続する。

VPS hostはroot所有で読み取り権限を限定した環境設定ファイルを管理する。Docker Composeはこの設定ファイルから、共通IAM identityの`AWS_ACCESS_KEY_ID`と`AWS_SECRET_ACCESS_KEY`をAPI containerとworker containerへ渡す。IAM identityはCognito、S3、DynamoDB、SQSへの接続を提供する。AWS SDK v3はstandard credential provider chainで認証情報を取得する。認証情報はDocker image、release manifest、構造化ログと分離して管理する。

## 観測性

APIとworkerはPinoでJSON構造化ログを標準出力へ出力する。各ログはtimestamp、level、service、environment、release、requestIdを持つ。HTTP requestのログはmethod、route、status、durationを持ち、認証後のログはOwner識別子を持つ。

ログとSentry eventはrequestIdで関連付ける。ログはtimestamp、level、service、environment、release、requestId、HTTP requestの状態、認証後のOwner識別子を記録する。

共通middlewareはrequest ID、secure headers、Pino logging、Sentry contextを提供する。

`application/json`のrequest bodyは最大1 MiB（1,048,576 bytes）を受け付ける。Honoのbody size middlewareはJSON requestに適用する。上限を超えるrequestはHTTP 413と`code: "PAYLOAD_TOO_LARGE"`、`message: "Request body exceeds the allowed size."`、`requestId`、`retryable: false`を持つresponseを返す。

## Dockerと設定

Node.js LTSのmulti-stage Docker buildでAPI imageを作成する。imageは`node dist/server.js`でAPIを、`node dist/worker.js`でworkerを起動する。各containerは一つのprocessをPID 1として実行する。

`src/config/env.ts`はZod schemaで実行環境、port、release、worker health URL、PostgreSQL接続URL、CognitoのRegion・User Pool ID・App Client ID、AWS Region・S3 bucket・SQS queue URL・DynamoDB table、Sentry DSNを検証する。開発環境とCIはS3、SQS、DynamoDBのendpoint URLを検証する。検証済みの設定値をAPI、worker、DB、AWS client、loggerへ渡す。

APIとworkerはSIGTERMまたはSIGINTを受けるとdraining状態になる。APIは新規HTTP requestの受付を停止し、workerは新規SQS long pollingを停止する。両containerは処理中の仕事を確定し、PostgreSQL、AWS client、Sentryを終了して30秒以内に終了状態を返す。

開発環境はPostgreSQL、DynamoDB Local、ElasticMQ、RustFSをComposeで提供する。

## E2E検証

バックエンド検証はAPI E2Eとworker E2Eで提供する。`docs/specs`の仕様ルール対応表は、仕様ルールID、仕様の参照先、E2Eの種別、scenario名を持つ。各仕様ルールは一意のIDを持ち、API E2Eまたはworker E2E scenarioは対応する仕様ルールIDをtest metadataとして持つ。

### API E2E

API E2EはHTTP経由で実行中のAPI processを操作し、PostgreSQL、DynamoDB Local、ElasticMQ、RustFS、JWKS fixtureと連携する。R0は次の状態を確認する。

- OpenAPI JSONと、API・worker・PostgreSQLの稼働状態を返すhealth endpoint
- schemaに一致する正常responseと失敗response
- PostgreSQL、SQS、S3、DynamoDBへの接続設定とready状態

### Worker E2E

worker E2Eは実行中のworker processを操作し、PostgreSQL、DynamoDB Local、ElasticMQへの接続設定、health状態、構造化ログを確認する。

仕様ルール対応表は、全ての仕様ルールに対応するE2E test IDを提供する。`npm run e2e`は対応表と成功したE2E scenarioの仕様ルールIDを照合する。仕様ルールに対応する成功済みscenarioがない場合、対応表に存在しないE2E IDがある場合、またはscenarioが失敗した場合は非ゼロ終了で結果を返す。

## コード品質

PR前ローカル検証とGitHub Actionsは`npm run check`で同じ品質ゲートを実行する。

| Command | 提供する検証 |
| --- | --- |
| `npm run lint` | ESLint、SonarJS、TypeScript strict type-aware rules |
| `npm run jscpd ` | jscpdによるproduction sourceの重複検出 |
| `npm run knip ` | knipによるunused export、file、dependency、importの検出 |
| `npm run typecheck` | TypeScript compile |
| `npm run e2e` | API E2E、worker E2E、仕様ルール対応表 |
| `npm run check` | 上記の順次実行 |

production sourceは関数50行、file 300行、循環的複雑度15、nesting 4、引数6を上限とする。ESLintはcognitive complexity、explicit any、unsafe value、未await Promise、循環importを品質ゲートとして検証する。E2E scenarioは型安全、未使用、importの検証を提供する。

jscpdはproduction sourceを検査対象とし、検出結果はSARIFとしてGitHub Code Scanningで表示する。knipはAPI server、worker、migration command、E2E runner、設定fileをentry pointとして検査する。

## 継続的提供

Pull Request workflowは`npm ci`と`npm run check`を実行し、ComposeによるE2E依存サービス環境でAPIとworkerのE2Eを実行する。E2E成功後にDocker imageをbuildする。workflowはOpenAPI JSON、仕様ルール対応表、静的解析report、image build結果をartifactとして提供する。

main publish workflowは同じ品質ゲートを完了後、GitHub OIDCでAWS roleを取得してECRへimageを公開する。release manifestはcommit SHA tag、image digest、OpenAPI versionを提供し、Sentry releaseはcommit SHAを使用する。

開発チームはrelease manifestのimage digestを指定してVPSへ反映する。migration containerは同じdigestでmigrationを適用し、API ready状態とworker ready状態を確認してreleaseを提供する。前のdigestはrollback対象として保持する。migrationは既存のAPIとworkerが読めるschema状態を提供する。

migration containerが失敗状態を返した場合、失敗したmigration version、error code、request ID、image digestを構造化ログとSentry eventへ記録する。VPSのAPIとworkerは現在のimage digestで稼働状態を提供する。開発チームはmigration containerのexit status、構造化ログ、release manifestを確認し、修正migrationを含む新しいimage digestを公開する。新しいdigestのmigration成功後にAPI、続いてworkerを更新し、ready状態を確認する。
