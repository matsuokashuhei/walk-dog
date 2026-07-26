# Development Session Log

- Purpose: Decide and execute today's development work.
- Created: 2026-07-26 14:15:18 JST

## Transcript

### User

今日は何をしようか？

### Assistant

この会話の目的は何ですか？  
このセッションを保存しますか？

### User

今日行う開発を決め、そして実行します。

### Assistant

このセッションを保存しますか？

### User

はい。

### Assistant

セッションを保存します。会話の記録を作成し、現状を確認してR0の次に着手すべき開発を絞り込みます。

### Assistant

`superpowers:brainstorming` を使い、既存のR0進捗に沿って、実装前に今日の作業範囲と完了条件を確定します。

### Assistant

現状はCognito基盤とExpoの雛形があり、R0のAPI・データ基盤は未着手です。今日はどれを優先しますか？

1. API基盤（OpenAPI、Node.js API、PostgreSQL、Docker）
2. モバイル基盤（認証状態、APIクライアント、送信キュー）
3. 運用基盤（Sentry、構造化ログ、ヘルスチェック）

### User

1をやろう。

### Assistant

API基盤を今日の対象にします。R0の順序を保ちながら、既存の仕様と構成を確認して、最初の縦切りを提案します。

### Assistant

既存のDocker ComposeはPostgreSQL、DynamoDB Local、S3互換ストレージ、SQS互換キューを提供しています。今日の完了範囲は、どちらにしますか？

1. APIの土台まで：OpenAPI、Node.js API、PostgreSQL migration、`/health`、Docker起動・テスト
2. 上記にOwner APIの最初の1本（認証済みOwner取得・表示名登録）まで含める

### User

1

### Assistant

範囲をAPIの土台に確定しました。次に、仕様どおりの契約中心設計を維持しつつ、今日完了できる構成案を比較します。

### Assistant

提案は次の3案です。

1. **Fastify + TypeBox + PostgreSQL driver**（推奨）  
   OpenAPIを実行時のリクエスト・レスポンス検証と同じスキーマから生成します。`/health`を契約テストで確認し、最初の業務APIを同じ枠組みで追加できます。
2. **Express + OpenAPI YAML + validator middleware**  
   YAMLを中心に契約を管理します。既存資産との相性はよい一方、ルート実装とスキーマの対応を保つ作業が増えます。
3. **NestJS + Swagger**  
   モジュール境界を早期に明確化できます。今日のAPI土台には初期構成と抽象化が大きめです。

推奨は1です。`apps/api`にAPIとmigrationを置き、`openapi.json`を生成し、ComposeにAPIサービスを加えます。環境変数でPostgreSQLとCognito設定を受け取り、`GET /health`はAPIとDBの接続状態を返します。migrationと契約・統合テストを揃えます。

### User

Honoを使ってAPIを作りたいです。それを前提に再検討してください。

### Assistant

Honoを前提に切り替えます。契約の単一ソースと型安全性を保てるHonoの構成へ再設計します。

### Assistant

Honoでは次の3案があります。

1. **`@hono/zod-openapi` + Zod + Node.js adapter**（推奨）  
   Zod schemaから入力検証、型、OpenAPI文書を生成します。`OpenAPIHono`で`/v1`の各ルートを宣言し、生成した文書をモバイルの型付きクライアント作成に渡します。
2. **`hono-openapi` + Standard Schema validator**  
   ValibotなどのStandard Schema対応validatorを選べます。スキーマの選択肢は広がりますが、このAPIの初期段階では採用判断が増えます。
3. **Hono + OpenAPI YAMLを別管理**  
   契約ファイルを直接編集できます。実装の検証定義と契約を同期する作業が継続的に発生します。

推奨する構成は1です。Hono公式の`@hono/zod-openapi`はZod schemaを用いて検証とOpenAPI生成を行い、Node.js adapterでNode.js上のHonoアプリを実行できます。

設計案（アーキテクチャ）:

- `apps/api/src/app.ts`: `OpenAPIHono`、request ID、共通エラー応答、`/v1/health`を合成する。
- `apps/api/src/routes/health.ts`: PostgreSQLへ接続確認を実行し、APIとDBの状態、request IDを返す。
- `apps/api/src/openapi.ts`: API情報とCognito Bearer認証schemeを定義し、`/openapi.json`を公開する。
- `apps/api/migrations/`: migrationの適用履歴をPostgreSQLに保持する。最初のmigrationでschema migration管理用テーブルを作成する。
- `apps/api/src/server.ts`: Node.js adapterでHTTP serverを起動する。
- `apps/compose.yml`: API serviceがPostgreSQLのhealthcheck完了後に起動し、ローカルの`/v1/health`を公開する。

テストはHonoの`app.request()`で、健康状態の正常応答とDB接続エラー時の応答を検証します。Honoはアプリに`Request`を渡して`Response`を検証できるため、HTTP serverを起動せずに契約テストを実行できます。

### User

もっと広く深く検討しましょう。

- Honoの公式サイトを見て、どのような選択肢があるかを洗い出す。
- APIを開発する上で必要な必要なタスクを洗い出す。

### Assistant

Hono公式情報を基に、実行ランタイム、契約・検証、認証、観測、テスト、デプロイまで選択肢を整理し、R0で必要なタスクへ落とし込みます。

### Assistant

HonoはWeb標準ベースでNode.js・Bun・Deno・Workers・Lambdaへ展開でき、Node.js adapterとDockerを使う現行のVPS方針にそのまま適合します。次に、ミドルウェアと契約・運用の選択肢を補完します。

### Assistant

## Honoで選べる構成

| 領域 | 選択肢 | walk / dogでの扱い |
| --- | --- | --- |
| 実行環境 | Node.js adapter、Bun、Deno、Cloudflare Workers、AWS Lambda | さくらVPSのDockerコンテナでNode.js adapterを使う。HonoのFetch API境界を保ち、将来の実行環境変更にも同じアプリを利用できる。 |
| HTTP server | `@hono/node-server`、HTTP/2 server | Node.js adapterのHTTP serverを使う。TLSはVPSのリバースプロキシで終端し、APIコンテナはHTTPで受ける。 |
| 契約と入力検証 | `@hono/zod-openapi`、`hono-openapi`とStandard Schema、Hono validator | `@hono/zod-openapi`を採用する。Zod schemaを入力検証、レスポンス、OpenAPI JSONの単一の定義にする。 |
| クライアント型 | OpenAPIから生成する型付きクライアント、Hono RPC client | モバイルはOpenAPIを正本として生成する型付きクライアントを使う。Hono RPCはサーバーと同一TypeScript配布物を使うクライアントに適する。 |
| 認証 | Bearer auth、JWT middleware、JWKS検証 middleware | CognitoのOIDC issuer・audience・JWKSを検証する専用middlewareを作り、検証済みのCognito subjectをOwner境界に渡す。 |
| 共通middleware | request ID、secure headers、CORS、body limit、compress、logger | request ID、構造化ログ、secure headers、環境別CORS、Avatar用body limitをR0で構成する。圧縮はリバースプロキシの設定と一体で決定する。 |
| エラー | `app.onError()`、routeごとのvalidation error応答 | OpenAPIに定義したエラー形式、HTTP status、retry可否を返す。全ルートで同じerror handlerを使う。 |
| テスト | `app.request()`、`testClient()`、Vitest | contract testは`app.request()`で実行し、PostgreSQLを含む統合テストはCompose環境で実行する。 |
| 観測 | request ID、Hono logger、Sentry/OpenTelemetry/Pino middleware | request IDをAPI応答・構造化ログ・Sentry eventへ関連付ける。Sentryとログ出力先をR0で確定する。 |

## API開発に必要なタスク

### R0で完了する基盤

1. **ワークスペースと実行環境**
   - `apps/api`のTypeScript package、Node.js version、npm scriptsを定義する。
   - Node.js adapter、Dockerfile、Compose service、開発時のwatch実行を用意する。
   - API・workerのhealthcheckをDocker ComposeとVPS向けコンテナで実行する。

2. **設定と秘密情報**
   - 環境変数のschema、ローカル用template、開発・本番の値の供給経路を定義する。
   - PostgreSQL、Cognito issuer・client ID・JWKS URL、S3、SQS、DynamoDB、Sentryを環境別に設定する。

3. **OpenAPI契約基盤**
   - `/v1`、API情報、Bearer security scheme、共通error response、pagination、Idempotency-Keyを定義する。
   - Zod route schemaからOpenAPI JSONを生成し、契約ファイルを成果物として固定する。
   - モバイルの型付きクライアント生成と契約テストの入力にOpenAPI JSONを接続する。

4. **HTTP境界**
   - request ID、構造化アクセスログ、CORS、secure headers、body size上限、例外処理を構成する。
   - `/v1/health`がAPI processと依存サービスの状態を返す。
   - validation、認証、競合、依存サービス障害をerror code、message、retry操作で返す。

5. **認証・認可境界**
   - Cognito access tokenのissuer、audience、署名、期限を検証する。
   - Cognito subjectとOwnerを対応付け、Owner単位でDog、Walk、Goal、Eventを照会・更新する。
   - 認証済みrouteをOpenAPI security requirementで宣言する。

6. **PostgreSQLとmigration**
   - migration実行器、migration履歴、開発・CI・VPSへの適用手順を定義する。
   - Owner、Dog、Goal Revision、Walk、Participant、Event、Preferenceのテーブルと一意制約をmigrationで作成する。
   - OwnerごとのDog名、Active Walk、Walk Participant、Event idempotencyをDB制約で保証する。

7. **非同期データ経路**
   - TrackPoint受理API、SQS message schema、worker、DynamoDB key・冪等性を定義する。
   - sequence、再配信、順不同、Finishの確定条件をテスト可能な境界にする。

8. **ファイル経路**
   - Avatarのcontent type、body size、S3 object key、参照URL、Owner・Dog更新を定義する。

9. **観測と運用**
   - API・workerごとのJSONログ項目、Sentry event、healthcheck、runbookを定義する。
   - VPSコンテナの起動・停止・migration・rollback・Sentry releaseを自動化する。

10. **検証と継続的デリバリー**
    - lint、typecheck、unit、OpenAPI contract、PostgreSQL integration、workerの再配信・順不同試験をCIに置く。
    - Docker imageをECRへ公開し、VPSに反映するGitHub Actions workflowを用意する。

### R1で基盤を利用して実装する業務API

- Owner、Dog、Goal、Walk、TrackPoint、Eventのrouteとserviceを追加する。
- Walkの状態遷移、Idempotency-Key、Event retry、Finish時のTrackPoint確定を実装する。
- Owner境界、Dog名一意性、Active Walk一意性、Event冪等性、Completed集計を統合テストで確認する。

### R2・R3で追加するAPI

- History、Contribution、Dog Goal Progress、Avatar、Owner、Preference、Email Change、法務文書のrouteを追加する。
- offset pagination、timezone集計、言語・単位・appearance・通知設定を契約に追加する。

## 今日のR0 API土台に含める最小成果物

- Hono + Node.js adapterのAPIコンテナ
- `@hono/zod-openapi`で生成する`/openapi.json`
- PostgreSQL接続とmigration実行器
- `/v1/health`のAPI・DB状態応答
- request ID、構造化ログ、共通error response
- Docker Compose起動、contract test、PostgreSQL integration test

次の設計判断は、PostgreSQLのmigrationとquery layerの選択です。候補を比較します。

### User

OK. ではチェックリスト化し、順番に決めていこう。

### Assistant

決定済み事項を固定し、R0の依存順でチェックリストを作ります。まず既存の開発ツール設定を確認して、最初の判断を一つに絞ります。

### Assistant

## R0 API基盤・決定チェックリスト

- [x] API framework: Hono
- [x] 配布方式: さくらVPSのDockerコンテナ、ECRから公開
- [x] API契約の正本: OpenAPI
- [ ] 1. 実行環境とパッケージ境界: `apps/api`の独立package、Node.js version、package manager、Docker build
- [ ] 2. HTTP契約: `/v1` versioning、OpenAPI生成、Zod validation、共通error response
- [ ] 3. PostgreSQL: migration tool、query layer、connection pool、schema ownership
- [ ] 4. Cognito: JWT/JWKS検証、Owner対応、認証済みrouteの契約
- [ ] 5. 共通middleware: request ID、構造化ログ、Sentry、CORS、secure headers、body limit、healthcheck
- [ ] 6. AWS接続境界: S3 Avatar、SQS TrackPoint、DynamoDB TrackPoint、設定schema
- [ ] 7. テスト: unit、OpenAPI contract、PostgreSQL integration、worker、fixture、ローカル実行
- [ ] 8. delivery: Docker image、ECR workflow、VPS反映、migration実行、rollback、運用runbook

R1の業務APIはこの基盤の後に、Owner、Dog、Goal、Walk、TrackPoint、Eventの順で追加します。

### 最初の判断: 実行環境とパッケージ境界

現状は`mise.toml`がNode.js LTSを定義し、モバイルは`apps/mobile`の独立npm packageです。選択肢は次の3案です。

1. **`apps/api`を独立したnpm packageにする**（推奨）  
   モバイルと同じ構成で`package-lock.json`を持つ。API単位でbuild、test、Docker imageを実行できる。
2. **root npm workspaceを導入する**  
   mobileとapiを一つのworkspaceで管理する。共通型・生成clientを置きやすい。
3. **pnpm workspaceへ統一する**  
   依存関係を効率的に管理できる。既存mobileのnpm lockfileを移行する。

推奨は1です。OpenAPI JSONを契約成果物にしてmobileへ渡すため、最初のR0でworkspace移行を必要とせず、既存構成を保てます。Node.jsは`mise`のLTSを使い、API Docker imageはNode.js 22 LTSを基準にします。

### User

下記のように構造化して質問してください

- WHAT 何を？
- WHY なぜ？
- HOW どのように？

### Assistant

以後の判断は、WHAT・WHY・HOWの順で提示します。最初の「実行環境とパッケージ境界」をこの形式に組み直します。

### Assistant

### 1. 実行環境とパッケージ境界

**WHAT — 何を？**  
APIを`apps/api`の独立したnpm packageとして作成する。

**WHY — なぜ？**  
既存の`apps/mobile`と同じ管理単位になり、API単位で依存関係、build、test、Docker imageを再現できる。OpenAPI JSONを契約成果物としてmobileへ渡すため、R0でworkspace移行を必要としない。

**HOW — どのように？**  
`apps/api`に`package.json`、`package-lock.json`、TypeScript設定、Hono application、test script、Dockerfileを置く。`mise`のNode.js LTSとNode.js 22 LTS Docker imageを使う。

### User

OK

### Assistant

実行環境とパッケージ境界を確定しました。続いて、OpenAPIを正本として実行時検証と生成成果物を一致させるHTTP契約を決めます。

### Assistant

### 2. HTTP契約

**WHAT — 何を？**  
`@hono/zod-openapi`を採用し、すべての`/v1` routeでZod schemaから入力検証、response schema、OpenAPI JSONを生成する。OpenAPI JSONは`GET /openapi.json`で提供する。すべての失敗応答は`code`、`message`、`requestId`、`retryable`を持つ共通形式にする。

**WHY — なぜ？**  
OpenAPIをAPI契約の正本として、サーバー検証、モバイルの型付きクライアント、契約テストに同じ定義を使える。入力不正、認証、競合、依存サービス障害で、画面が表示する状態と再試行操作を一意に決められる。

**HOW — どのように？**  
route moduleごとに`createRoute`でrequestとresponseを宣言し、`OpenAPIHono.openapi`へhandlerを登録する。共通schemaは`src/contracts`に置き、`src/app.ts`で`/v1`へrouteを合成する。validation error、認証失敗、競合、依存サービス障害は`app.onError()`とroute middlewareで共通error responseに変換する。CIが`/openapi.json`を契約成果物として生成し、差分と契約テストを確認する。

### User

OK

### Assistant

HTTP契約を確定しました。次は、PostgreSQLのmigrationとquery layerを、制約・トランザクション・型・運用手順の観点で比較して決めます。

### Assistant

### 3. PostgreSQL migrationとquery layer

**WHAT — 何を？**  
`pg`をPostgreSQL driverとして採用し、連番付きSQL migrationとparameterized SQLを使うquery layerを作成する。migrationは`apps/api/migrations`に置き、適用済みversionをPostgreSQLのmigration履歴テーブルに記録する。

**WHY — なぜ？**  
Owner境界、Dog名、Active Walk、Walk Participant、Event idempotencyはPostgreSQLの一意制約、外部キー、check制約で定義する。SQL migrationはその制約とindexをそのままレビュー、CI、VPS反映に使える。`pg`はconnection poolとparameterized queryを提供し、複数の書込みを同じclientでtransactionにまとめられる。

**HOW — どのように？**  
`src/db/pool.ts`が単一の`Pool`を作成し、`src/db/transaction.ts`が同じclientで`BEGIN`、query、`COMMIT`を実行する。repositoryはOwner、Dog、Walkなどのaggregate単位でparameterized SQLを発行する。`npm run migrate`はadvisory lockを取得し、未適用の`migrations/NNNN_description.sql`を順にtransactionで適用して履歴を記録する。API processはstart前にmigrationを実行し、VPS反映時は同じimageのmigration commandを一度実行してからAPIとworkerを更新する。

比較した選択肢は、Drizzle + `pg`、Kysely、`pg` + SQL migrationである。DrizzleはTypeScript schemaからmigrationを生成し、Kyselyは型付きquery builderとmigration primitivesを提供する。R0ではPostgreSQL固有の制約をSQLで明確に扱う`pg` + SQL migrationを採用する。

### User

Honoの公式ガイドに推奨の構成はありますか？

### Assistant

Hono公式ガイドに、アプリ構成・ルート分割・型共有について明示された推奨があるかを確認し、今回の構成案と照合します。

### Assistant

あります。ただしHonoは、データベースやドメイン層までを固定する完全なアーキテクチャを規定していません。公式の推奨は、型推論を維持するroute中心の構成です。

- Rails風のControllerを作らず、path定義の直後にhandlerを置く。
- 大きいアプリはresource単位のroute moduleへ分け、root appが`app.route()`でmountする。
- Hono RPCを使う場合は、route定義をmethod chainにして`AppType`をexportする。今回のmobileはOpenAPI生成を使うため、RPCは採用対象にしない。
- Node.jsでは`@hono/node-server`で起動し、SIGINTとSIGTERMを処理してserverを終了する。公式はNode.js 22 Alpineのmulti-stage Dockerfileも示している。

このため、今回の構成は次のように更新する。

```text
src/
  app.ts                 # OpenAPIHono、共通middleware、/v1 mount
  server.ts              # Node.js adapter、graceful shutdown
  routes/
    health.ts            # health routeとhandler
    owners.ts            # R1で追加
    dogs.ts              # R1で追加
    walks.ts             # R1で追加
  db/
    pool.ts              # pg Pool
    transaction.ts       # transaction helper
    owner-queries.ts     # Owner SQL
    dog-queries.ts       # Dog SQL
  contracts/             # OpenAPI/Zodの共通schema
```

`routes`はHonoのroute moduleとしてrequest・response・handlerを一緒に置く。`db`はSQL実行とtransactionを担当し、HTTP handlerをControllerへ移す構成にはしない。これによりHonoの型推論と、PostgreSQL制約をSQLで扱う方針を両立できる。

### User

型推論と相性がよいデータベース層の技術選択はなんですか？

### Assistant

Honoのroute型と、PostgreSQL schemaから得られる型をどこまで一貫させるかが焦点です。Honoと各DB技術の公式情報を照合して、選択肢を比較します。

### Assistant

型推論を主目的にするなら、**Drizzle ORM + `pg`**が最も相性がよい。Honoとの専用integrationを必要とせず、TypeScriptのPostgreSQL table定義からselect・insertの型を推論し、Hono routeではOpenAPI/Zod schemaを使う構成にできる。

| 選択肢 | 型の起点 | 推論の範囲 | このAPIとの適合 |
| --- | --- | --- | --- |
| **Drizzle ORM + `pg`** | TypeScriptのtable schema | column nullability、select結果、insert値、query結果 | 最も適合。PostgreSQL schemaとqueryの型を一緒に変更でき、SQL migrationを生成してreviewできる。 |
| Kysely + `pg` | TypeScriptのdatabase interface | queryのtable・column・join・select結果 | SQL表現を重視する場合に適合。database interfaceをmigrationと同期する運用を持つ。 |
| `pg`のみ | queryごとのTypeScript type | query結果の型注釈 | SQLを最小抽象で使える。table schemaからの自動推論は持たない。 |

Drizzleのtable schemaはPostgreSQLのtable、column、constraint、indexを定義し、`$inferSelect`と`$inferInsert`で型を得る。queryのselect結果はnullabilityを含めて推論され、valuesはparameterized SQLへ変換される。`pg` driverを使うため、connection poolとtransactionの実行基盤は維持できる。

ただし、DB row typeをAPI responseへ直接返す構成にはしない。外部契約はZod/OpenAPI schema、内部永続化はDrizzle schemaとして用途を分け、route handlerがDB rowをresponse DTOへ変換する。OwnerやDogのprofile公開項目、集計値、日時表現をAPI契約として独立して維持できる。

PostgreSQL判断は次の案に更新する。

**WHAT — 何を？**  
Drizzle ORMを`pg` driver上で使い、TypeScript table schemaからSQL migrationを生成する。生成したSQL migrationをrepositoryでreviewし、VPSでは同じimageのmigration commandで適用する。

**WHY — なぜ？**  
PostgreSQL schema変更、query、insert値、select結果をTypeScriptが追跡し、Honoのtyped routeに渡すデータの不整合を開発時に検出できる。PostgreSQLのconstraintとindexは生成SQLとして確認できる。

**HOW — どのように？**  
`src/db/schema`にOwner、Dog、Goal Revision、Walk、Participant、Event、Preferenceをtableごとに定義する。`src/db/client.ts`で`Pool`をDrizzleへ渡し、route moduleがdomainごとのquery functionを呼ぶ。`drizzle-kit generate`がSQL migrationを作成し、`drizzle-kit migrate`がmigration履歴を持って適用する。transactionが必要な操作は`db.transaction()`で実行する。

### User

OK.

### Assistant

PostgreSQLはDrizzle ORM + `pg`で確定しました。次はCognito tokenの検証とOwner境界を、既存Terraform設定とAWS公式仕様に合わせて決めます。

### Assistant

既存Cognitoは公開クライアントでEMAIL_OTPとPASSWORDを受け付け、access token・ID tokenを1日有効に設定しています。API側はaccess tokenを受け、Cognitoの公開鍵とclaimを検証する構成を確認します。

### Assistant

### 4. Cognito認証とOwner境界

**WHAT — 何を？**  
APIはCognito **access token**をBearer tokenとして受け取り、`aws-jwt-verify`で署名、期限、issuer、user pool、app client、`token_use: access`を検証する。検証済みprincipalはCognito subjectを持ち、Ownerはこのsubjectに一意に対応付ける。

**WHY — なぜ？**  
Cognito access tokenは外部APIの認可に使うtokenで、`client_id`、scope、`token_use`を持つ。AWSはNode.jsで`aws-jwt-verify`の利用を推奨しており、JWKSのkey rotationを含む署名検証とapp client検証を行える。Owner IDをリクエストから受けず、principalから解決することで、Dog、Walk、Goal、EventをOwner単位で一意に扱える。

**HOW — どのように？**  
`src/auth/cognito.ts`が`COGNITO_USER_POOL_ID`、`COGNITO_APP_CLIENT_ID`、`AWS_REGION`から`CognitoJwtVerifier`を一度作成する。`src/middleware/authentication.ts`がAuthorization headerからaccess tokenを検証し、`c.var.principal`へ`subject`を設定する。認証済みrouteはprincipalのsubjectからOwnerを解決し、すべてのqueryをそのOwner IDで実行する。`/v1/health`と`/openapi.json`は認証なしで提供し、業務routeはOpenAPI security requirementでBearer authを宣言する。Owner tableは`cognito_subject`の一意制約を持つ。

既存Terraformのaccess token 1日設定はCognitoの5分から1日という許容値に含まれる。R1のOwner登録routeは、検証済みsubjectを使ってOwnerを一意に作成・取得する。

### User

OK

### Assistant

Cognito認証とOwner境界を確定しました。続いて、APIとworkerの状態遷移を観測できるよう、共通middleware、構造化ログ、Sentry、healthcheckを決めます。

### Assistant

### 5. 共通middleware、観測、healthcheck

**WHAT — 何を？**  
Honoのrequest ID、secure headers、環境別CORSを共通middlewareとして使う。PinoでJSON構造化ログを標準出力へ出し、Sentryで未処理例外と依存サービス障害を収集する。APIは`/health/live`と`/health/ready`を、workerは同じ状態区分のhealth endpointを提供する。

**WHY — なぜ？**  
request IDを応答、APIログ、workerログ、Sentry eventで共有すると、Walk、TrackPoint、Finishの状態遷移を一つの操作として追跡できる。Honoのrequest ID middlewareはNode.js adapterでIDを生成または引継ぎ、secure headersとCORSは共通HTTP境界を定義できる。Honoの標準loggerは人が読む出力を提供するため、VPSコンテナで検索・集計できるJSONログはPinoで出力する。

**HOW — どのように？**  
middlewareはrequest ID、secure headers、CORS、Pino request logger、Sentry context、routeの順に登録する。Pino recordは`timestamp`、`level`、`service`、`environment`、`release`、`requestId`、HTTP method、route、status、durationを持つ。認証済みのrecordにはOwner IDを持たせ、email、token、request body、位置情報は記録しない。Sentry eventにはrequest ID、service、release、environmentをtagとして設定する。CORS originは`CORS_ALLOWED_ORIGINS`で定義し、AuthorizationとIdempotency-Keyを許可headerに含める。

`/health/live`はprocessがrequestを受け付ける状態を返す。`/health/ready`はPostgreSQL接続を確認してAPIがrequestを処理できる状態を返す。workerのready endpointはSQSとDynamoDB接続設定を読み込み、queue pollingとDynamoDB書込みを処理できる状態を返す。Docker ComposeとVPSのhealthcheckはready endpointを使う。

### User

JSON構造化ログを標準出力へ出す手段としてPinoが最有力ですか？
Honoの公式ガイドの推奨を確認してください。
Honoに推奨がない場合、代替手段を洗い出し、それらを比較して評価してください。

### Assistant

Hono公式がPinoを推奨しているかを先に確認し、推奨が限定的ならNode.js向け構造化ロガーを公式資料で比較します。

### Assistant

HonoはPinoを第三者middlewareの選択肢として掲載しますが、採用を指定してはいません。次に、Honoで利用できる候補をJSON出力、request context、Node.js運用、依存の小ささで比較します。

### Assistant

結論として、**Hono公式にPinoの採用推奨はない**。Hono公式は、内蔵`logger()`、custom `PrintFunc`、custom middlewareを提供し、第三者middleware一覧にPino loggerとLogTapeを並列に掲載している。

| 手段 | JSON Lines | request context | stdout運用 | 評価 |
| --- | --- | --- | --- | --- |
| Hono内蔵logger + custom PrintFunc | custom実装で提供 | custom実装で提供 | 提供 | 小さいAPIには適合。log record、level、error serializer、redactionをアプリ側で保つ。 |
| **Pino + Hono custom middleware** | 標準で提供 | child loggerでrequest ID・Owner IDを付与 | 標準出力へ提供 | **推奨**。Node.jsコンテナで、API・workerが同一record形式を使える。 |
| LogTape + Hono custom middleware | JSON Lines formatter | context-local stateを利用 | sinkで提供 | 有力。runtime横断性と細かな設定を重視する場合に適合。設定概念が増える。 |
| Winston + Hono custom middleware | JSON formatter | child loggerまたはmetadataで付与 | Console transportで提供 | 複数の出力先をアプリで使う場合に適合。stdoutだけのコンテナではtransport構成が大きい。 |
| Bunyan + Hono custom middleware | JSONを標準出力 | child loggerで付与 | 提供 | JSON専用の成熟した選択肢。新規R0ではPinoのHono連携資料とNode.js運用を優先する。 |

Hono内蔵loggerはmethod、path、status、処理時間を人が読む形式で記録し、custom PrintFuncを渡せる。Honoが求めるのは「middlewareでrequest前後を処理する」構造であり、loggerの採用判断はアプリに委ねている。PinoはJSONを標準出力に書き、child loggerで相関情報を共通fieldへ加え、transportをworker threadで動かせる。LogTapeはJSON Linesとcontext-local stateを提供する。

walk / dogはVPS上のNode.js APIとworkerで、request ID、Owner ID、Walk ID、TrackPoint sequenceを同じJSON recordへ付与する。アプリは標準出力だけを出し、コンテナ外のログ収集が保存・検索を担う。この条件ではPinoが最も小さく要件を満たす。

### 5. 共通middleware、観測、healthcheckのログ方針の更新

**WHAT — 何を？**  
PinoをJSON構造化ロガーとして採用し、Hono custom middlewareとworkerから同じlogger factoryを使う。

**WHY — なぜ？**  
HonoはPinoを選択肢として扱い、PinoはJSON出力、child logger、Node.js向け非同期transportを提供する。APIとworkerの相関情報を一つのrecord形式で扱える。

**HOW — どのように？**  
`src/observability/logger.ts`がservice、environment、releaseを持つbase loggerを作る。Hono middlewareはrequest IDを持つchild loggerをcontextへ設定し、response後にHTTP recordを出す。auth middlewareはOwner IDをchild loggerへ追加し、Walk・TrackPoint処理はWalk ID・sequenceを追加する。開発環境は`pino-pretty`、VPSはJSON Linesを標準出力へ出す。

### User

OK

### Assistant

Pinoを使う観測方針を確定しました。次はR0の外部データ境界として、S3 Avatar、SQS TrackPoint、DynamoDB TrackPointの接続責務とメッセージ契約を決めます。

### Assistant

### 6. S3、SQS、DynamoDB接続境界

**WHAT — 何を？**  
AWS SDK for JavaScript v3を使い、S3、SQS、DynamoDB clientを設定schemaから作成する。`apps/api`はHono API processとTrackPoint worker processを同じpackage・別commandで提供する。APIはAvatarをS3へ保存し、TrackPointをSQS Standardへ送信する。workerはSQS messageを処理し、DynamoDBへTrackPointを確定する。

**WHY — なぜ？**  
Avatar、TrackPoint受理、TrackPoint確定の境界を分けると、モバイルの散歩記録はSQS受理後に応答でき、workerは再配信と順不同を処理できる。SQS Standardはat-least-once配信とbest-effort orderingを提供するため、DynamoDBのconditional writeとWalk内sequenceで重複・順不同を一意に扱う。S3 object keyはOwnerまたはDogとasset IDから生成し、同じ表示名のファイル名をデータ境界に使わない。

**HOW — どのように？**  
`src/aws/config.ts`がregion、bucket、queue URL、DynamoDB table、endpoint、credentialsをZodで検証する。local環境はComposeのRustFS、ElasticMQ、DynamoDB Local endpointを、VPSはAWS endpointを使う。`src/storage/avatar-store.ts`、`src/queue/track-point-queue.ts`、`src/track-points/store.ts`が各AWS SDK clientを隠す。

TrackPoint messageは`walkId`、`ownerId`、`sequence`、`recordedAt`、`latitude`、`longitude`、受理時刻を持つ。workerはDynamoDBのpartition keyをWalk ID、sort keyをsequenceとしてconditional putし、同じWalk・sequenceのmessageを一意に確定する。SQSのduplicate deliveryとout-of-order deliveryは同じmessage処理結果へ収束する。Finish時の連番確定は、workerが確定したsequenceをWalk状態へ反映するR1の状態遷移として実装する。

Avatarは認証済みOwnerがAPIへ送信し、APIが対象OwnerまたはDogのS3 object keyへ保存し、そのobject keyをPostgreSQLのprofile情報に記録する。APIは読み取り用の参照URLを返す。

### User

質問です。
1. AWS SDK for JavaScript の v3は最新バージョンですか？
2. Dockerで稼働するので１コンテナに複数のプロセスを実行できません。その点はどうしますか？

### Assistant

AWS SDKの現行世代を公式資料で確認し、コンテナはAPIとworkerを別imageまたは同一imageの別サービスとして単一processで動かす構成へ修正します。

### Assistant

1. **AWS SDK for JavaScript v3は、現在サポートされている最新のmajor versionです。**

   AWS SDK for JavaScript v2は2025年9月8日にend-of-supportとなり、AWSはv3への移行を案内しています。v3はserviceごとのmodular package、TypeScript-first、middleware stackを提供します。実装では`@aws-sdk/client-s3`、`@aws-sdk/client-sqs`、`@aws-sdk/client-dynamodb`を個別に依存へ追加し、`package-lock.json`で具体的なreleaseを固定します。

2. **APIとworkerは別コンテナで実行します。**

   「同じpackage、別command」は、同じコンテナ内で二つのprocessを起動する意味にはしません。共通のAPI imageを一度buildし、ComposeとVPSで`api` serviceと`worker` serviceを別コンテナとして起動します。

   - `api` container: `node dist/server.js`をPID 1として実行し、Hono HTTP APIを提供する。
   - `worker` container: `node dist/worker.js`をPID 1として実行し、SQS pollingとDynamoDB確定を提供する。

   両コンテナは同一image、同一release、同一migration version、共通のAWS設定schemaとloggerを使用する。APIとworkerはDocker Composeで個別にscale、restart、healthcheck、Sentry service nameを持つ。

このため、接続境界の記述は「同じpackage・別command」から「同一image・別service・別container」へ更新する。

### User

ok

### Assistant

外部データ境界を確定しました。次は、R0の品質ゲートとしてunit・OpenAPI契約・PostgreSQL統合・worker再配信をどの環境で検証するか決めます。

### Assistant

### 7. テスト戦略

**WHAT — 何を？**  
Vitestをtest runnerとして採用し、unit、Hono contract、PostgreSQL integration、worker integrationの4層を提供する。すべてのtestは`apps/api`から実行し、PostgreSQL、DynamoDB Local、ElasticMQ、RustFSを使うintegration testはDocker Composeで起動する。

**WHY — なぜ？**  
Honoは`app.request()`でHTTP serverを起動せずにrequestとresponseを検証できる。OpenAPIを正本にするため、routeのsuccess、認証、入力不正、競合、retryable errorを契約として確認する。PostgreSQLの一意制約とtransaction、SQS Standardのduplicate・out-of-order delivery、DynamoDB conditional writeは実際の接続先で検証する。

**HOW — どのように？**  
`npm run test:unit`はdomain function、error mapping、AWS adapterのmessage変換を実行する。`npm run test:contract`はHono appへ`app.request()`を送信し、`/openapi.json`とroute responseを検証する。`npm run test:integration`はComposeのtest serviceへmigrationを適用し、PostgreSQLとlocal AWS servicesを使う。worker testは同じTrackPoint messageを複数回、順序を変えて処理し、DynamoDBにWalk内sequenceごとの一意なitemが確定することを検証する。

fixtureはOwner 2名、Dog、Active Walk、Completed Walkを持ち、Owner境界、Dog名一意性、Active Walk一意性、Event冪等性、Finish時の連番確定を各releaseで追加する。testごとにdatabase schemaとqueueを初期化し、固定時刻とUUID generatorを使って期待値を一意にする。

### User

テストはバックエンドにおけるE2Eのみ行ってください。つまり、API単位とworker単位です。このテストで内部仕様のテストを100%カバーしてください。
この方針で再度検討してください。

### Assistant

方針をE2E専用へ変更します。内部の関数やadapterを個別に検証せず、実行中のAPIとworkerに対する外部観測可能な結果で、仕様ルールをすべて確認する設計に組み直します。

### Assistant

### 7. バックエンドE2Eテスト戦略

**WHAT — 何を？**  
testはAPI E2Eとworker E2Eだけを提供する。API E2Eは実行中のAPI containerへHTTP requestを送る。worker E2Eは実行中のworker containerへSQS messageを送る。両方ともPostgreSQL、DynamoDB Local、ElasticMQ、RustFS、認証用JWKS fixtureを依存serviceとして使う。

**WHY — なぜ？**  
HTTP response、PostgreSQLの永続データ、SQS message、S3 object、DynamoDB item、workerの状態を一連の結果として確認できる。route、middleware、認証、validation、transaction、AWS adapter、queue consumerを実際のprocess間接続で検証する。

**HOW — どのように？**  

1. **API E2E**
   - API imageを`api-e2e` containerとして起動し、test runnerはHTTPで`/openapi.json`、health endpoint、`/v1` routeを呼ぶ。
   - JWKS fixtureが署名するCognito access tokenをAuthorization headerで送り、valid token、期限切れ、署名不一致、異なるapp client、ID tokenを確認する。
   - requestの結果として、HTTP status・共通error response・response body・PostgreSQL row・SQS message・S3 objectを確認する。

2. **worker E2E**
   - worker imageを`worker-e2e` containerとして起動し、test runnerはElasticMQへTrackPoint messageを送る。
   - DynamoDB item、PostgreSQLのWalk sequence状態、worker logを確認する。
   - 同一messageの重複、sequenceの順不同、worker restart、再配信、DynamoDB条件失敗、Finishの連番確定を確認する。

3. **仕様カバレッジ**
   - `docs/specs`とOpenAPI route schemaの各規則に一意なtest IDを割り当てる。
   - test IDは認証、入力、状態遷移、一意性、冪等性、Owner境界、集計、retry、依存サービス障害を対象にする。
   - CIは仕様ルール一覧とE2E test IDの対応表を検証し、すべての規則が少なくとも1件のAPI E2Eまたはworker E2Eで確認される状態を品質ゲートにする。

ここでの100%は、内部仕様として定義したすべての規則がE2E testで確認される**仕様ルールカバレッジ100%**を表す。line coverageやprivate function単位のcoverageは品質ゲートに含めない。

Composeは通常の依存serviceに加え、`api-e2e`、`worker-e2e`、JWKS fixtureをtest profileで起動する。各test suiteは専用database、queue、bucket prefix、DynamoDB table prefixを使い、suite完了後に初期化する。

### User

ok

### Assistant

E2E専用の品質ゲートを確定しました。最後に、GitHub Actionsの検証・ECR公開と、開発チームによるVPS反映の手順を決めます。

### Assistant

### 8. CI/CDとVPS反映

**WHAT — 何を？**  
GitHub ActionsはPull Requestでlint、typecheck、API E2E、worker E2E、Docker image buildを実行する。`main`へのmergeは同じ検証を通過したimageをECRへcommit SHA tagとimage digestで公開する。開発チームはVPSでdigestを指定し、migration、API container、worker containerを順に反映する。

**WHY — なぜ？**  
E2E品質ゲートを通過したimageだけをECRへ公開し、VPSはmutable tagではなくimmutable digestを指定することで、API、worker、migrationが同一releaseで動く。GitHub ActionsはAWS OIDCで短期credentialを取得でき、長期AWS credentialをGitHub secretに保存しない。段階的なVPS反映は、APIとworkerのready状態、migration、Sentry releaseを確認しながら進められる。

**HOW — どのように？**  

1. **Pull Request workflow**
   - `apps/api`のdependencyをinstallし、lint、typecheck、E2E Compose profileを実行する。
   - APIとworkerのimageをbuildし、E2E suiteがそのimageを起動する。
   - OpenAPI JSONと仕様ルールカバレッジ表をartifactとして保存する。

2. **main publish workflow**
   - Pull Requestと同じquality gateを実行する。
   - GitHub OIDCでAWS roleをassumeし、ECRへimageをpushする。
   - imageはcommit SHA tagとdigestをrelease manifestへ記録する。Sentry releaseもcommit SHAにする。

3. **VPS反映**
   - 開発チームはrelease manifestのdigestを指定してimageをpullする。
   - 同じdigestのmigration commandを一度実行する。
   - API containerを更新し、`/health/ready`を確認する。
   - worker containerを更新し、worker ready状態とSentry serviceを確認する。
   - rollbackは直前のimage digestへ戻す。migrationは既存APIとworkerが読めるschema変更を先に適用する。

GitHub ActionsのAWS roleはECR pushに必要な最小権限を持ち、trust policyは対象repositoryとmain publish workflowを条件にする。外部actionはcommit SHAを指定してworkflowに記録する。

### User

トークンの検証はAWSのライブラリーを使うよね？ライブラリーが担保していることはテスト不要。
その上で、このエンドポイントでは何をテストするの？

### Assistant

そのとおりです。署名・JWKS・claim の暗号学的検証そのものは `aws-jwt-verify` の責務で、当方の E2E 対象ではありません。E2E で確認する価値があるのは、アプリ側の token 受け取り・エラー応答・認証済み principal の引き渡しです。

### User

Crit review completed.

### Assistant

Crit の最終コメントを確認し、未解決コメントがない状態でレビューを完了しました。

### User

では今日の成果をPRにしてください。

### Assistant

PR 作成には GitHub 連携の手順を使います。変更範囲・現在の branch・レビュー済み設計書を確認し、今回の成果だけを commit・push・PR 作成します。

### Assistant

PR に含める範囲を確認します。未追跡の変更が混在しているため、今回の成果としてレビュー済み設計書とセッションログのみを PR に含めます。

### User

ok

### Assistant

範囲を確認しました。レビュー済み設計書と今回のセッションログだけを、現在の branch から draft PR として作成します。

### Assistant

`GET /v1/session`で確認できるのは、Authorization headerの受け取り、検証失敗の共通HTTP 401応答への変換、検証済み`sub`のroute handlerへの引き渡しです。ただし、この三点だけのために公開endpointを増やす価値は薄いです。R0の`GET /v1/session`は追加せず、R1の最初の認証済み業務endpointで統合処理をE2E確認します。

### User

ok

### Assistant

R0 にテスト専用 endpoint は追加せず、認証統合の E2E は R1 の最初の認証済み業務 endpoint で確認します。R0 設計書の E2E 対象をこの判断に合わせます。

### User

ok

### Assistant

承認ありがとうございます。合意した R0 設計を計画書と整合する設計書にまとめ、内容確認をお願いした後に実装計画へ進めます。

### Assistant

設計書を作成し、既存計画との整合と文書ルールを確認しました。R0 の実装範囲、運用、E2E、品質ゲートを一つに集約しています。

### User

最初に作ったチェックリストを使い、最初の計画と最後の結果を比較して、過不足がないか確認してください。

### Assistant

最初のチェックリストを基準に、合意済みの R0 設計と突き合わせます。実装へ進む前に、項目ごとの充足・追加・不足を明確にします。

### User

では追加でやることをまたチェックリスト化して、それから順番に確認していこう。

### Assistant

不足と R0 範囲の調整を、依存順の追加チェックリストにします。各項目はこれまでどおり WHAT・WHY・HOW で一つずつ確定します。

### User

ok

### Assistant

1 を確定しました。R0 設計から R1/R2 の業務状態遷移を分離し、R0 が提供する基盤と検証対象を更新します。

### Assistant

### 2. 実行時設定とコンテナ停止

**WHAT — 何を？**  
Zod で環境変数 schema を定義し、API と worker が同じ設定値を検証して起動します。API・worker は `SIGTERM` と `SIGINT` を受けると、最大 30 秒の graceful shutdown を行います。

**WHY — なぜ？**  
Cognito、PostgreSQL、S3、SQS、DynamoDB の接続情報を起動時に一貫して確認できます。VPS の更新時には API が新規 request の受付を止め、worker が新規 message の受信を止めた後に、処理中の仕事を確定して終了できます。

**HOW — どのように？**  
`src/config/env.ts` が Zod で実行環境、port、release、PostgreSQL 接続 URL、Cognito、AWS 接続先、CORS 許可 origin、Sentry DSN を検証します。検証済みの設定値を API、worker、DB、AWS client、logger へ渡します。API は終了シグナル受信時に draining 状態となり、新規 HTTP request の受付を停止します。worker は新規 SQS long polling を停止し、処理中の message を確定します。両者は PostgreSQL・AWS client・Sentry を終了し、30 秒以内に終了状態を返します。

### User

ok

### Assistant

2 を確定しました。設定を一つの Zod schema で検証し、API と worker の終了状態を Docker 運用に追加します。

### Assistant

### 3. HTTP 認証契約

**WHAT — 何を？**  
OpenAPI に `BearerAuth` security scheme を定義し、認証済みの `/v1` route が access token を必要とすることを契約として表現します。

**WHY — なぜ？**  
モバイルの型付き client と API 利用者が、認証が必要な endpoint を OpenAPI から一意に判断できます。認証失敗時の画面状態と再試行操作も共通の API 応答で扱えます。

**HOW — どのように？**  
`components.securitySchemes` に `type: http`、`scheme: bearer`、`bearerFormat: JWT` の `BearerAuth` を定義します。認証済み route は OpenAPI の `security: [{ BearerAuth: [] }]` を持ち、認証 middleware が handler より前に Cognito access token を検証します。token 未指定、期限切れ、署名不一致、issuer・User Pool・App Client・`token_use` 不一致の状態は、HTTP 401 と`UNAUTHENTICATED`、`requestId`、`retryable: false`を持つ共通エラー形式を返します。

### User

質問のフォーマットを改善してください。
WHAT、WHY、HOWの部分とあなたの質問の境界をつけてください。
確認するため、再度質問してください。

### Assistant

承知しました。設計提案と確認依頼を明確に分けます。3 を同じ内容で再提示します。

### Assistant

### 3. HTTP 認証契約

**WHAT — 何を？**  
OpenAPI に `BearerAuth` security scheme を定義し、認証済みの `/v1` route が access token を必要とすることを API 契約として表現します。

**WHY — なぜ？**  
モバイルの型付き client と API 利用者が、認証が必要な endpoint を OpenAPI から判断できます。認証失敗時は共通の応答形式で画面状態と再試行操作を扱えます。

**HOW — どのように？**  
`components.securitySchemes` に `type: http`、`scheme: bearer`、`bearerFormat: JWT` の `BearerAuth` を定義します。認証済み route は `security: [{ BearerAuth: [] }]` を持ち、認証 middleware が handler より前に Cognito access token を検証します。token 未指定、期限切れ、署名不一致、issuer・User Pool・App Client・`token_use` 不一致は、HTTP 401 と `UNAUTHENTICATED`、`requestId`、`retryable: false`を持つ共通エラー形式で返します。

### User

ok

### Assistant

3 を確定しました。OpenAPI の認証定義と、認証失敗時の応答を設計書へ追加します。

### User

ちょっとまって

### Assistant

承知しました。ここで止めます。

### User

認証を不要とするエンドポイントもあるよね、その場合はどうなる？

### Assistant

はい。認証が必要な route だけに `BearerAuth` を適用し、公開 endpoint は OpenAPI 上で認証不要として宣言します。

### Assistant

はい。認証要否は endpoint ごとに OpenAPI で表現します。`/v1` は API のバージョン境界であり、認証要否とは独立です。`/v1/auth/sign-up`、`/v1/auth/sign-in`、`/v1/auth/confirm-otp`は公開endpointであり、`/v1/owners/me`、`/v1/dogs`、`/v1/walks`は認証済みendpointです。`/openapi.json`、`/health/live`、`/health/ready`は運用用の公開endpointです。

### User

わかりました。okです。

### Assistant

3 を、公開・認証済みの `/v1` route を endpoint ごとに宣言する方針として確定します。設計書を補正してから、次の PostgreSQL 運用項目へ進みます。

### Assistant

### 4. PostgreSQL 運用

**WHAT — 何を？**  
`pg.Pool` を API・worker ごとに 1 個作成し、接続上限は `DATABASE_POOL_MAX`（既定値 10）で設定します。Drizzle の migration は同一 image の one-shot migration container が適用し、PostgreSQL advisory lock で migration 実行を一意にします。R0 の migration は Drizzle の migration 履歴と、Cognito subject を一意に保持する Owner 対応 table を提供します。R1 は Owner、Dog、Goal Revision、Walk、Participant、Event の業務 table と制約を追加します。

**WHY — なぜ？**  
API と worker の接続数を予測可能にし、VPS 反映時に同じ migration が一度だけ順序どおり適用されます。Owner 対応を先に提供することで、認証済み principal を以後の業務データの所有者へ一意に結び付けられます。

**HOW — どのように？**  
`src/db/client.ts` が検証済み設定から `pg.Pool` と Drizzle client を作成します。`npm run migrate` はPostgreSQL advisory lockの取得、未適用migrationの適用、Drizzle migration履歴の更新、適用versionの構造化ログ出力、lock解放を実行します。migrationが失敗した場合、migration containerは失敗状態と対象migrationを構造化ログへ出力します。開発チームはmigrationを修正・追加したimage digestを指定して再実行し、APIとworkerはmigration成功後に更新します。

### User

複数のことを質問しているように感じ、判断できない。
この質問を分解しよう。

### Assistant

その通りです。接続運用、migration 排他、R0 の schema 範囲、失敗時の反映手順は別々の判断です。4 を四つに分解します。

### Assistant

### 4. PostgreSQL 運用の分解

- [ ] 4-1. DB client と connection pool
- [ ] 4-2. migration 履歴と排他制御
- [ ] 4-3. R0 migration に含める schema
- [ ] 4-4. migration 失敗時の VPS 反映手順

### 4-1. DB client と connection pool

**WHAT — 何を？**  
API container と worker container は、それぞれ `pg.Pool` を一つ作成し、その Pool を Drizzle client に渡します。接続上限は `DATABASE_POOL_MAX` で設定し、既定値を 10 とします。

**WHY — なぜ？**  
各 container の PostgreSQL 接続数を設定値で把握でき、API・worker の query と transaction が同じ接続管理方法を利用できます。

**HOW — どのように？**  
`src/db/client.ts` が `DATABASE_URL` と `DATABASE_POOL_MAX` から `pg.Pool` を生成します。終了処理は Pool を close し、処理済み connection を PostgreSQL へ返します。

### User

ok

### Assistant

4-1 を確定しました。API と worker が個別の connection pool を持つ構成を設計書へ追加し、次は migration の排他制御だけを確認します。

### Assistant

### 4-2. migration 履歴と排他制御

**WHAT — 何を？**  
Drizzle が適用済み migration の version・hash・適用時刻を PostgreSQL に記録します。migration container は、適用中に PostgreSQL advisory lock を保持します。

**WHY — なぜ？**  
適用済み migration を database 自身から判定できます。VPS の更新操作が重なった場合も、一つの migration container が順序どおりに schema を更新します。

**HOW — どのように？**  
`npm run migrate` は専用の PostgreSQL session を開始し、`walk_dog_schema_migration` 用の advisory lock を取得します。その session で Drizzle migration を実行し、適用した migration version を構造化ログへ出力します。migration 終了時に session を閉じ、lock を解放します。

### User

質問方法を改善しよう。WHO、WHEN、WHEREもつけてくれないか？
順番は
1 When（いつ）、2 Where（どこで）、3 Who（誰が）、 4 What（何を）、 5 Why（なぜ）、6 How（どのように）

### Assistant

承知しました。以後の設計判断は **When → Where → Who → What → Why → How** の順で提示し、その後を確認依頼として分けます。4-2 をこの形式で再提示します。

### Assistant

### 4-2. migration 履歴と排他制御

**WHEN — いつ？**  
VPS へ新しい image digest を反映する前に、一度実行します。

**WHERE — どこで？**  
VPS 上で、対象 release と同じ Docker image から起動する one-shot migration container が実行します。migration 履歴と lock は PostgreSQL に保持します。

**WHO — 誰が？**  
開発チームが release manifest の image digest を指定して実行します。

**WHAT — 何を？**  
Drizzle が適用済み migration の version・hash・適用時刻を PostgreSQL に記録します。migration container は、適用中に PostgreSQL advisory lock を保持します。

**WHY — なぜ？**  
適用済み migration を database 自身から判定でき、更新操作が重なった場合も一つの migration container が順序どおりに schema を更新できます。

**HOW — どのように？**  
`npm run migrate` は専用の PostgreSQL session を開始し、`walk_dog_schema_migration` 用の advisory lock を取得します。その session で Drizzle migration を実行し、適用した migration version を構造化ログへ出力します。migration 終了時に session を閉じ、lock を解放します。

### User

ok

### Assistant

4-2 を確定しました。migration 履歴と PostgreSQL advisory lock を設計書へ追加し、次は R0 に含める database schema だけを確認します。

### Assistant

### 4-3. R0 migration に含める schema

**WHEN — いつ？**  
R0 の PostgreSQL 初回 migration を実行するときです。

**WHERE — どこで？**  
開発環境、CI の E2E 環境、VPS の PostgreSQL に同じ migration を適用します。

**WHO — 誰が？**  
開発チームが Drizzle schema を変更し、生成された SQL migration をレビューします。VPS では migration container が適用します。

**WHAT — 何を？**  
R0 の業務 table は `owners` だけにします。`owners` は内部 Owner ID、Cognito `sub` を保持する `cognito_subject`、作成日時、更新日時、`cognito_subject` の一意性を提供します。R1 で Dog、Goal Revision、Walk、Participant、Event の table と制約を追加します。

**WHY — なぜ？**  
認証済み principal をアプリケーションの Owner と一意に結び付ける基盤を先に提供できます。R1 の業務状態遷移は、対応する API と同じリリースで table・制約・E2E を追加できます。

**HOW — どのように？**  
Drizzle の `owners` table 定義から SQL migration を生成します。`cognito_subject` に unique constraint を置き、migration をレビューしてから開発環境、CI、VPS へ同じ順序で適用します。

### User

ok

### Assistant

4-3 を確定しました。R0 は Owner 対応 table を提供し、R1 から業務 table を追加する順序を設計書へ反映します。

### Assistant

### 4-4. migration 失敗時の VPS 反映手順

**WHEN — いつ？**  
新しい release の migration container が失敗状態を返したときです。

**WHERE — どこで？**  
VPS 上の migration container、Pino の構造化ログ、Sentry event、release manifest を使用します。

**WHO — 誰が？**  
開発チームが失敗を確認し、修正 release を作成して再実行します。

**WHAT — 何を？**  
migration container は失敗した migration version、error code、request ID、image digest を構造化ログと Sentry event に記録します。VPS の API・worker は現在の image digest で稼働状態を維持します。

**WHY — なぜ？**  
migration の結果を release 単位で追跡でき、稼働中の API・worker は検証済み schema に接続し続けられます。

**HOW — どのように？**  
VPS runbook は migration container の exit status と構造化ログを確認し、release manifest の image digest と migration version を記録します。修正 migration を含む新しい image digest を ECR へ公開し、その migration container を実行します。成功後に API、続いて worker を更新し、ready 状態を確認します。

### User

ok

### Assistant

4-4 を確定しました。migration 失敗時は稼働中の release を維持し、修正 digest の migration 成功後に API・worker を更新する手順を設計書へ追加します。次の HTTP 入力境界は三つに分けて確認します。

### Assistant

### 5. HTTP 入力境界の分解

- [ ] 5-1. R0 の JSON request size
- [ ] 5-2. R2 の Avatar content type と file size
- [ ] 5-3. CORS 許可 origin

### 5-1. R0 の JSON request size

**WHEN — いつ？**  
API が JSON request body を受け付けるときです。

**WHERE — どこで？**  
Hono API container の共通 middleware で検証します。

**WHO — 誰が？**  
モバイル client が JSON を送信し、API が request body のサイズを判定します。

**WHAT — 何を？**  
`application/json` の request body は最大 1 MiB（1,048,576 bytes）を受け付けます。

**WHY — なぜ？**  
R0 の認証・設定系 request と、R1 の TrackPoint 送信に十分なサイズを提供し、API container が予測可能な memory 使用量で request を処理できます。

**HOW — どのように？**  
Hono の body size middleware を共通 middleware に登録します。上限を超える request は HTTP 413 と `PAYLOAD_TOO_LARGE`、`requestId`、`retryable: false`を持つ共通エラー形式を返します。

### User

確認方法を改善してほしい

確認は「この 5-1 を確定してよいですか？」ではなく、5W1Hに分解した質問の本質部分にしてほしい。
例
〜の場合〜をします。よいですか？

### Assistant

承知しました。以後は 5W1H を提案の構造として示し、確認では判断対象を一文で問います。5-1 は「JSON の上限値を 1 MiB とするか」が本質なので、その形で再確認します。

### Assistant

### 5-1. R0 の JSON request size

**WHEN — いつ？**  
API が JSON request body を受け付けるときです。

**WHERE — どこで？**  
Hono API container の共通 middleware で検証します。

**WHO — 誰が？**  
モバイル client が JSON を送信し、API が request body のサイズを判定します。

**WHAT — 何を？**  
`application/json` の request body は最大 1 MiB（1,048,576 bytes）を受け付けます。

**WHY — なぜ？**  
R0 の認証・設定系 request と R1 の TrackPoint 送信に十分なサイズを提供し、API container が予測可能な memory 使用量で処理できます。

**HOW — どのように？**  
Hono の body size middleware を共通 middleware に登録します。上限を超える request は HTTP 413 と共通エラー形式を返します。

JSON request が 1 MiB を超える場合、API は HTTP 413 を返す方針でよいですか？

### User

画像のアップロードは1 Mibを超えると思う。その場合はどうなりますか？

### Assistant

画像 upload は JSON 上限とは別の入力境界です。R0 の 1 MiB 制限は `application/json` だけに適用し、R2 の Avatar endpoint には content type と file size を専用に定義します。

### Assistant

画像 upload は JSON 上限とは別です。R0 の 1 MiB 上限は `application/json` にだけ適用します。R2 の Avatar endpoint は `multipart/form-data` を受け付け、画像専用の file size 上限を定義します。Avatar の上限を超える場合は、その endpoint が HTTP 413 を返します。

### User

ok

### Assistant

5-1 を確定します。1 MiB の制限は `application/json` に適用し、Avatar は R2 の専用 endpoint で別に扱います。続いて、Avatar の受入形式と上限サイズを決めます。

### Assistant

### 5-2. Avatar 入力境界の分解

- [ ] 5-2a. 許可する画像形式
- [ ] 5-2b. 画像ファイルの上限サイズ

### 5-2a. 許可する画像形式

**WHEN — いつ？**  
R2 で Owner または Dog の Avatar を更新するときです。

**WHERE — どこで？**  
`multipart/form-data` を受け付ける Avatar endpoint と、S3 object の `Content-Type` で検証します。

**WHO — 誰が？**  
認証済み Owner が自身または自身の Dog の画像を送信し、API が画像形式を検証して S3 へ保存します。

**WHAT — 何を？**  
`image/jpeg`、`image/png`、`image/heic` を受け付けます。

**WHY — なぜ？**  
JPEG と PNG はアプリで広く扱え、HEIC は iPhone で撮影した写真をそのまま Avatar として利用できます。

**HOW — どのように？**  
API は multipart の file part の MIME type を確認し、許可した形式を S3 object の `Content-Type` として保存します。許可形式以外は HTTP 415 と共通エラー形式を返します。

iPhone で撮影した HEIC を含め、Avatar は JPEG・PNG・HEIC を受け付ける方針でよいですか？

### User

r2の話だと思うけど、いま判断する必要ありますか？あるなら考える。

### Assistant

今決める必要はありません。R0 では Avatar endpoint を提供せず、画像形式・上限サイズは R2 の開始時に実際のモバイル選択・変換方式と一緒に確定するのが適切です。

### Assistant

R0 で必要なのは、JSON の 1 MiB 制限を画像 upload に適用しないことだけです。5-2 は R2 の開始判断として保留し、次の R0 項目へ進めます。

### User

ok

### Assistant

5-2 は R2 開始時の判断として保留します。R0 の最後の HTTP 入力項目として、iOS native client と将来の browser client に対応する CORS の扱いを確認します。

### Assistant

### 5-3. CORS 許可 origin

**WHEN — いつ？**  
browser client が別 origin の API へ request を送るときです。

**WHERE — どこで？**  
Hono API container の CORS middleware で判定します。

**WHO — 誰が？**  
browser client が `Origin` header を送信し、API が環境設定の許可 origin と照合します。iOS native client は API へ直接 request を送信します。

**WHAT — 何を？**  
`CORS_ALLOWED_ORIGINS` を環境設定の origin 一覧として扱い、一覧に一致する browser client へ CORS response header を返します。

**WHY — なぜ？**  
R0 の iOS native client は API を直接利用でき、browser client を追加する時点で開発・preview・本番の origin を環境別に定義できます。

**HOW — どのように？**  
`CORS_ALLOWED_ORIGINS` は完全な origin の配列として Zod で検証します。CORS middleware は一致した origin に `Access-Control-Allow-Origin`、許可 method、許可 header を返します。

browser client を追加する時点で `CORS_ALLOWED_ORIGINS` に origin を登録し、その origin だけへ CORS response header を返す方針でよいですか？

### User

APIのクライアントはモバイルアプリだけです。その前提で再度質問してください。

### Assistant

前提を反映します。iOS native アプリだけが API client であれば、CORS は R0 の通信要件になりません。5-3 をモバイル専用の前提で再提示します。

### Assistant

### 5-3. モバイル専用 API の CORS

**WHEN — いつ？**  
iOS native アプリが API へ HTTPS request を送るときです。

**WHERE — どこで？**  
モバイルアプリと Hono API container の HTTP 通信で処理します。

**WHO — 誰が？**  
walk / dog のモバイルアプリが API client として request を送ります。

**WHAT — 何を？**  
R0 の API はモバイルアプリからの HTTP request を受け付けます。CORS は browser client を提供するリリースで定義します。

**WHY — なぜ？**  
iOS native アプリの HTTP 通信は browser の origin 制約を受けず、CORS response header を必要としません。

**HOW — どのように？**  
R0 では CORS middleware と `CORS_ALLOWED_ORIGINS` を API 設定から外します。モバイルアプリは API base URL と Cognito access token を使って request を送ります。

モバイルアプリ専用の R0 では CORS middleware を導入せず、browser client を提供するリリースで CORS を定義する方針でよいですか？

### User

、browser client を提供するリリースはいまのところ予定していない。だから考えなくていいよ。

### Assistant

承知しました。CORS は将来項目としても扱わず、API 設計と設定 schema から外します。モバイルアプリ専用 API の通信前提だけを保持します。

### Assistant

次は R0 の AWS 接続設定です。SQS message と Avatar の業務契約は R1/R2 に保留し、ここでは API・worker が AWS SDK v3 client をどの設定と認証情報で初期化するかだけを確認します。

### Assistant

### 6. AWS 接続設定の分解

- [ ] 6-1. 環境ごとの AWS service endpoint
- [ ] 6-2. VPS container の AWS 認証情報
- [ ] 6-3. R1 の SQS TrackPoint message 契約
- [ ] 6-4. R2 の S3 Avatar 保存契約

### 6-1. 環境ごとの AWS service endpoint

**WHEN — いつ？**  
API・worker container が起動し、S3・SQS・DynamoDB client を初期化するときです。

**WHERE — どこで？**  
`src/config/env.ts` と AWS SDK v3 client の初期化処理で設定します。開発環境と CI は Compose の RustFS、ElasticMQ、DynamoDB Local を接続先にします。VPS は AWS の各 service を接続先にします。

**WHO — 誰が？**  
API と worker が、検証済みの環境設定を使って AWS SDK v3 client を作成します。

**WHAT — 何を？**  
`AWS_REGION` を共通設定とし、`S3_ENDPOINT`、`SQS_ENDPOINT`、`DYNAMODB_ENDPOINT` を環境別の service endpoint として設定します。

**WHY — なぜ？**  
開発環境と CI は実際の HTTP 接続で AWS 互換 service を検証でき、VPS は同じ client 実装から AWS の service を利用できます。

**HOW — どのように？**  
Zod schema が endpoint URL を検証し、S3・SQS・DynamoDB client にそれぞれ渡します。VPS の環境設定は AWS service の endpoint URL を提供します。

開発・CI は Compose の AWS 互換 service、VPS は AWS service へ、同じ AWS SDK v3 client から接続する方針でよいですか？

### User

ok.
エンドポイントは開発環境とCI環境だけ必要。AWSでは不要だよね。

### Assistant

そのとおりです。VPS では AWS SDK v3 が `AWS_REGION` から各 AWS service の標準 endpoint を解決するため、endpoint URL の設定は不要です。開発・CI だけがローカル service の endpoint を設定します。

### Assistant

### 6-2. VPS container の AWS 認証情報

**WHEN — いつ？**  
VPS の API・worker container が AWS SDK v3 client を初期化するときです。

**WHERE — どこで？**  
VPS host 上の root 所有・読み取り権限を限定した環境設定ファイルから、Docker Compose を通じて container へ渡します。

**WHO — 誰が？**  
開発チームが AWS のサービス用 IAM 認証情報を発行し、VPS 運用者が環境設定ファイルを更新します。API・worker は AWS SDK v3 の標準 credential provider chain で認証情報を取得します。

**WHAT — 何を？**  
`AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` を API・worker に渡します。

**WHY — なぜ？**  
さくら VPS は AWS の compute identity を持たないため、AWS service へアクセスする認証情報を container 実行時に提供します。認証情報は Docker image、release manifest、構造化ログと分離して管理できます。

**HOW — どのように？**  
VPS の環境設定ファイルを Docker Compose の `env_file` に指定します。AWS SDK v3 は環境変数から認証情報を読み取り、`AWS_REGION` の AWS service endpoint へ request を送ります。

さくら VPS では、root 所有の環境設定ファイルから API・worker へ AWS 認証情報を渡す方針でよいですか？

### User

ok

### Assistant

6-2 を確定しました。VPS の AWS 認証情報は image と release manifest から分離し、host の root 所有設定ファイルから API・worker へ渡します。次は、その IAM 認証情報に与える操作範囲だけを確認します。

### Assistant

### 6-2a. API・worker の IAM identity

**WHEN — いつ？**  
VPS の API・worker container を起動するときです。

**WHERE — どこで？**  
AWS IAM と、VPS host の API 用・worker 用の環境設定ファイルで設定します。

**WHO — 誰が？**  
開発チームが API 用と worker 用の IAM identity を管理し、VPS 運用者が対応する認証情報を各 container へ設定します。

**WHAT — 何を？**  
API と worker は、それぞれ専用の IAM identity と AWS 認証情報を使用します。

**WHY — なぜ？**  
API は S3 と SQS、worker は SQS と DynamoDB を利用します。container ごとの identity により、各 process が必要な AWS 操作を個別に定義できます。

**HOW — どのように？**  
VPS は API 用と worker 用の root 所有環境設定ファイルを持ち、それぞれの `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` を対応する container だけへ渡します。IAM policy は各 release が利用する AWS service と resource に対応する action を定義します。

API と worker に、それぞれ専用の IAM identity を割り当てる方針でよいですか？

### User

差がS3しかない。だから一緒でいいよ。
API
- S3
- DynamoDB
- SQS
Worker
- DynamoDB
- SQS

### Assistant

承知しました。API と worker は同じ IAM identity を使い、S3・DynamoDB・SQS を共通の AWS 接続範囲とします。個別 identity には分けません。

### Assistant

### 6-2b. R0 の IAM 操作範囲

**WHEN — いつ？**  
R0 の API・worker が起動し、AWS service の ready 状態を確認するときです。

**WHERE — どこで？**  
共通 IAM identity の policy で、R0 環境の S3 bucket、SQS queue、DynamoDB table に対して定義します。

**WHO — 誰が？**  
API と worker が同じ IAM identity を使用します。開発チームが policy を管理します。

**WHAT — 何を？**  
R0 の IAM policy は、S3の`HeadBucket`、SQSの`GetQueueAttributes`、DynamoDBの`DescribeTable`を対象resourceに許可します。R1はSQSの送受信、DynamoDBのTrackPoint読み書きを追加します。R2はS3のAvatar object操作を追加します。

**WHY — なぜ？**  
R0 は AWS service の接続・ready 状態を確認できます。業務データを扱う操作は、それを提供するリリースと同時に IAM policy へ追加できます。

**HOW — どのように？**  
Terraform は R0 環境の bucket、queue、table の ARN を policy resource として定義します。API・worker の ready 処理は各 AWS SDK v3 client で対応する接続確認操作を実行します。

R0 では S3・SQS・DynamoDB の接続確認操作だけを許可し、業務データ操作は R1/R2 で追加する方針でよいですか？

### User

R0で決める必要ある？

### Assistant

設計判断としては、今は不要です。R0 の実装・VPS 配置前には必要ですが、resource ARN と ready 実装が揃う時点で Terraform の実装項目として具体化できます。

### Assistant

今確定したのは、API・worker が共通 IAM identity を使い、対象 service が S3・DynamoDB・SQS であることまでです。操作単位の権限は R0 実装時に定義します。

### User

Cognitoも対象だ

### Assistant

そのとおりです。共通 IAM identity の対象 service に Cognito も加えます。Cognito access token の JWKS 検証と、必要な Cognito service 操作を同じ AWS 接続範囲として扱います。

### Assistant

そのとおりです。共通 IAM identity の対象 service は Cognito、S3、DynamoDB、SQSです。操作単位の IAM policy は、R0 実装時に必要な Cognito 操作も含めて Terraform で定義します。

### User

ok

### Assistant

AWS の業務契約は R1/R2 の開始時に確定するため、R0 の追加判断としてはここで保留します。次は、API/worker E2E で仕様ルールカバレッジ 100% を機械的に確認する方法を分解します。

### Assistant

### 7. E2E 仕様ルールカバレッジの分解

- [ ] 7-1. 仕様ルールと E2E の対応表
- [ ] 7-2. 100% カバレッジの CI 判定
- [ ] 7-3. API/worker E2E の実行環境と runner

### 7-1. 仕様ルールと E2E の対応表

**WHEN — いつ？**  
API または worker の仕様ルールを追加・変更するときです。

**WHERE — どこで？**  
`docs/specs` に置く仕様ルール対応表と、`apps/api` の API/worker E2E scenario で管理します。

**WHO — 誰が？**  
開発チームが仕様ルールと E2E scenario を追加し、CI が対応関係を検証します。

**WHAT — 何を？**  
各仕様ルールに一意の ID を付け、API E2E または worker E2E の scenario に同じ ID を対応付けます。

**WHY — なぜ？**  
外部から観測できる API 応答、認証、状態遷移、永続データ、queue 処理の各ルールが、実行中の container を通じて検証される状態を確認できます。

**HOW — どのように？**  
対応表は、仕様ルール ID、仕様の参照先、E2E の種別、scenario 名を持ちます。E2E scenario は対応する仕様ルール ID を test metadata として持ちます。

仕様ルール ID と API/worker E2E scenario の対応表を `docs/specs` で管理する方針でよいですか？

### User

ok

### Assistant

7-1 を確定しました。仕様ルール ID と API/worker E2E scenario の対応表を `docs/specs` で管理します。次は、その対応表を CI が 100% と判定する条件だけを確認します。

### Assistant

### 7-2. 100% カバレッジの CI 判定

**WHEN — いつ？**  
開発者が `npm run e2e` を実行するときと、GitHub Actions が Pull Request・`main` を検証するときです。

**WHERE — どこで？**  
`apps/api` の E2E 実行結果と、`docs/specs` の仕様ルール対応表を照合します。

**WHO — 誰が？**  
E2E runner が実行済み scenario の仕様ルール ID を出力し、カバレッジ検証 script が対応表と照合します。

**WHAT — 何を？**  
すべての仕様ルール ID が、成功した API E2E または worker E2E scenario に一件以上対応する状態を、仕様ルールカバレッジ 100% とします。

**WHY — なぜ？**  
仕様に書かれたルールと、実際に container を通して確認したルールの対応を、PR 前と CI で同じ基準で確認できます。

**HOW — どのように？**  
`npm run e2e` は E2E 実行後に対応表と実行済み ID を照合します。未対応の仕様ルール ID、対応表に存在しない E2E ID、失敗した scenario がある場合は非ゼロ終了で結果を返します。

仕様ルールに対応する成功済み E2E scenario が一件もない場合、`npm run e2e` と CI を失敗させる方針でよいですか？

### User

ごめん、質問の意味がわからない。

### Assistant

説明が抽象的でした。ここで決めたいのは、仕様に書いた各ルールへ E2E テストを必ず一つ以上結び付け、結び付かないルールがある PR は通さない、という一点です。具体例で再提示します。

### Assistant

例えば、仕様に `AUTH-001: access token がない request は HTTP 401 を返す` を書きます。このルールには、tokenなしでrequestを送りHTTP 401を確認するAPI E2Eを一つ以上登録します。PRで`AUTH-001`を仕様へ追加したのに対応E2Eを書かなかった場合、`npm run e2e`とCIは失敗します。これが仕様ルールカバレッジ100%の意味です。

仕様にルールを追加・変更した場合は、対応する API または worker E2E を必ず追加しないと PR を通さない方針でよいですか？

### User

ok

### Assistant

7-2 を確定しました。仕様変更には対応する API/worker E2E を必須とし、対応しない PR は品質ゲートで止めます。続いて、E2E を実行する runner と Compose 環境を確認します。

### Assistant

### 7-3. API/worker E2E の実行環境と runner

**WHEN — いつ？**  
開発者が PR 前に `npm run e2e` を実行するときと、GitHub Actions が Pull Request・`main` を検証するときです。

**WHERE — どこで？**  
Docker Compose の E2E profile で、API container、worker container、PostgreSQL、DynamoDB Local、ElasticMQ、RustFS、JWKS fixture を起動して実行します。

**WHO — 誰が？**  
開発者と GitHub Actions が同じ command を実行します。Vitest が API E2E と worker E2E を実行します。

**WHAT — 何を？**  
Vitest をバックエンド E2E の runner とし、実行中の API container には HTTP request を、実行中の worker container には SQS message を送ります。

**WHY — なぜ？**  
ローカルと CI が同じ依存サービス・同じ container image・同じ E2E command を使用できます。HTTP、queue、database、object storage の結果を一連の外部動作として検証できます。

**HOW — どのように？**  
`npm run e2e` は Compose E2E profile を起動し、API・worker の ready 状態を確認してから `vitest run` を実行します。API E2E と worker E2E は終了後に仕様ルール ID を出力し、対応表の検証結果とともに終了します。

API/worker E2E は Vitest と Docker Compose E2E profile で、実行中の container を対象に行う方針でよいですか？

### User

これも質問の意味がわからない。

### Assistant

ここは設計判断と実装手段を混ぜていました。質問の内容は「E2E の test code を何で起動するか」で、既に合意した“実行中の API・worker container を対象に E2E を行う”方針を変えるものではありません。Vitest と Compose の選定は R0 実装時の作業項目として扱います。

### User

ok

### Assistant

E2E の仕様・判定方針は確定し、runner の具体化は R0 実装作業として扱います。最後に、CI/CD・VPS の残りを小さな判断へ分解します。

### Assistant

### 8. CI/CD・VPS の分解

- [x] 8-1. PR 前と CI の共通品質ゲート
- [ ] 8-2. PR CI の Docker image 検証
- [x] 8-3. `main` の ECR 公開
- [x] 8-4. VPS 反映と migration 失敗時の手順

### 8-2. PR CI の Docker image 検証

**WHEN — いつ？**  
Pull Request を作成・更新したときです。

**WHERE — どこで？**  
GitHub Actions の PR workflow と Compose E2E 環境で実行します。

**WHO — 誰が？**  
GitHub Actions が API image を build し、開発者は同じ手順をローカルで実行できます。

**WHAT — 何を？**  
PR CI は API・worker を起動する Docker image を build し、その image を使って API/worker E2E を実行します。

**WHY — なぜ？**  
TypeScript の実行結果だけでなく、Node.js runtime、production dependency、entrypoint、container 設定を含む release 対象の image を検証できます。

**HOW — どのように？**  
Compose E2E profile が API image を build し、同じ image から API container と worker container を起動します。E2E 成功後、PR workflow は image build の結果とテスト artifact を提供します。

PR CI では、E2E を source code ではなく build 済み Docker image に対して実行する方針でよいですか？

### User

いや、それだとテストに時間がかかる。テストに成功したらDockerイメージを作成しよう。

### Assistant

了解です。PR CI は API/worker E2E を先に成功させ、その後に Docker image を build します。E2E は API・worker の実行 process と依存サービスを対象にし、image build は検証済みソースから行います。

### Assistant

PR CI の順序を、静的品質ゲート・typecheck、API/worker E2E、E2E成功後のDocker image build、build結果と検証artifactの保存へ変更しました。これにより、Docker buildを待たずにテスト結果を得られます。

### User

ok

### Assistant

追加チェックリストの判断は完了しました。設計書の整合を最終確認し、R0 で実装時に確定する項目と R1/R2 へ保留する項目を分けます。

### Assistant

整合確認で二点を補正します。開発・CI 用 endpoint を設定 schema に含め、E2E は Docker image 作成前の API・worker process を対象にする記述へ統一します。

### Assistant

整合確認を完了しました。R0 設計では、AWSのendpoint URLは開発・CIのみ設定し、API・workerは共通IAM identityでCognito・S3・DynamoDB・SQSを利用します。E2Eを先に実行して成功後にDocker imageをbuildし、E2Eは実行中のAPI・worker processを対象にします。Avatar契約はR2、SQS TrackPoint契約はR1へ保留し、CORSは扱いません。

R0 の Cognito 検証を E2E で確認するために、認証済み endpoint が必要です。次はこの endpoint を R0 に置くかを一項目として確認します。

### User

ok

### Assistant

R0 の Cognito 検証を API E2E で確認できるよう、認証済み session endpoint の要否を一つの判断として提示します。

### Assistant

### 9. R0 の認証済み session endpoint

**WHEN — いつ？**  
モバイルアプリが Cognito access token を取得した後、および API E2E が token 検証を確認するときです。

**WHERE — どこで？**  
Hono API の `GET /v1/session` で提供します。OpenAPI は `BearerAuth` を設定します。

**WHO — 誰が？**  
認証済みモバイルアプリと API E2E が呼び出し、API が Cognito access token を検証します。

**WHAT — 何を？**  
`GET /v1/session` は、検証済み token の Cognito `sub` を返します。

**WHY — なぜ？**  
Cognito の署名、期限、issuer、User Pool、App Client、`token_use` の検証を、実行中の API を通じて E2E で確認できます。

**HOW — どのように？**  
route は `BearerAuth` を必要とし、認証 middleware が token を検証します。API E2E は有効な token で `subject` を確認し、token 未指定・期限切れ・署名不一致・claim 不一致で HTTP 401 を確認します。

R0 に `GET /v1/session` を追加し、検証済み Cognito `sub` を返す方針でよいですか？

### User

目的はトークンの検証処理のテストですか？

### Assistant

はい。提案した endpoint の主目的は、Cognito token 検証を E2E で確認することです。テストだけのために公開 API を追加するのは適切ではないため、R0 と R1 のどちらで認証検証を外部契約として提供するかに分けて判断します。

### User

GitHub ActionsのCIとPR前のローカル検証で下記を行ってください。

- 関数とファイルの大きさ、複雑度をESLintで縛る
- 「動くけど後で困るコード」をSonarJS+strictで潰す
- コピペコードを見つける — jscpd
- デッドコードを消す — knip

具体的な方法は https://zenn.dev/singularity/articles/clean-code-ci-for-ai-era#3.-%E3%82%B3%E3%83%94%E3%83%9A%E3%82%B3%E3%83%BC%E3%83%89%E3%82%92%E8%A6%8B%E3%81%A4%E3%81%91%E3%82%8B-%E2%80%94-jscpd をみてください。

### Assistant

指定の記事を確認し、ESLint・SonarJS・jscpd・knipをPR前ローカル検証とGitHub Actionsの同一品質ゲートへ組み込みます。

### Assistant

### 8. CIとPR前ローカル検証のコード品質ゲート

**WHAT — 何を？**  
API packageにESLint、SonarJS、TypeScript strict type-aware rules、jscpd、knipを追加する。開発者はPR前に`npm run check`を実行し、GitHub Actionsは同じcommandをE2Eの前に実行する。

**WHY — なぜ？**  
ESLintは関数・ファイルの大きさと複雑度を、SonarJSとTypeScript strict type-aware rulesは読みにくい制御構造、unsafe value、未await Promiseを、jscpdはファイル横断の重複を、knipはentry pointから到達しないexport・file・dependencyを検出する。新規のAPI packageでは既存違反がないため、品質ゲートを最初からerrorとして運用できる。

**HOW — どのように？**

1. **ESLintとSonarJS**
   - `typescript-eslint`の`strictTypeChecked`、SonarJSのrecommended config、import cycle検出を有効にする。
   - production sourceでは`max-lines-per-function: 50`、`complexity: 15`、`max-depth: 4`、`max-params: 6`、`sonarjs/cognitive-complexity`、`no-explicit-any`、`no-floating-promises`、`no-misused-promises`、`no-unsafe-*`、`import/no-cycle`をerrorにする。
   - E2E test sourceは実行シナリオを読みやすく保つため、関数行数・複雑度の閾値を対象外にし、型安全・未使用・import規則は同じ品質ゲートで確認する。

2. **jscpd**
   - production sourceをtoken列で検査し、新しい重複を品質ゲートで検出する。
   - `node_modules`、build output、型宣言、E2E scenarioを対象外にする。
   - SARIF reportをGitHub Code Scanningへuploadし、PR上で重複のfileと位置を表示する。

3. **knip**
   - API server、worker、migration command、E2E test runner、ESLint・Drizzle・Vitest設定をentry pointとして定義する。
   - production sourceのunused export、unused file、unused dependency、unresolved importを品質ゲートで検出する。
   - generated fileと設定上のentryを`knip.json`に明示し、検出対象と除外理由をrepositoryで管理する。

4. **同一command**
   - `npm run lint`、`npm run duplication`、`npm run dead-code`、`npm run typecheck`、`npm run e2e`を個別に提供する。
   - `npm run check`がこの順に実行する。PR前のローカル検証とGitHub Actionsは`npm run check`を使う。

jscpdとknipは、コードを削除・共通化する判断材料を示す。品質ゲートでは指摘された重複または未使用要素について、共通化、削除、または設定上の利用目的を明示する状態を求める。

### User

これらをあなたが最初に提案した内容に盛り込んで再度提案してください。

### Assistant

最初のCI/CD・VPS反映案へ、PR前ローカル検証とGitHub Actionsのコード品質ゲートを統合して再提案します。

### Assistant

### 8. CI/CDとVPS反映

**WHAT — 何を？**  
PR前のローカル検証とGitHub ActionsのCIで、同じコード品質ゲート、API E2E、worker E2E、Docker image buildを実行する。`main`へのmergeは検証済みimageをECRへcommit SHA tagとimage digestで公開する。開発チームはVPSでdigestを指定し、migration、API container、worker containerを順に反映する。

**WHY — なぜ？**  
ローカルとCIが同じ`npm run check`を使うことで、PR前に品質上の問題を確認できる。ESLintとSonarJSは大きさ・複雑度・型安全性を、jscpdは重複を、knipは到達しないコードを検出する。E2E品質ゲートを通過したimageだけをECRへ公開し、VPSはimmutable digestを指定することで、API、worker、migrationが同一releaseで動く。GitHub ActionsはAWS OIDCで短期credentialを取得し、長期AWS credentialをGitHub secretに保存しない。

**HOW — どのように？**

1. **PR前ローカル検証**
   - `npm run lint`はESLint、SonarJS、TypeScript strict type-aware rulesを実行する。production sourceでは関数50行、file 300行、循環的複雑度15、nesting 4、引数6を上限とし、cognitive complexity、explicit any、unsafe value、未await Promise、循環importをerrorにする。
   - `npm run duplication`はjscpdでproduction sourceのtoken重複を検出する。build output、型宣言、E2E scenarioは対象外にする。
   - `npm run dead-code`はknipでAPI server、worker、migration command、E2E runner、設定fileから到達しないexport、file、dependency、importを検出する。
   - `npm run typecheck`と`npm run e2e`はTypeScript compileとAPI・worker E2Eを実行する。
   - `npm run check`が上記すべてを順に実行する。

2. **Pull Request workflow**
   - GitHub Actionsは`npm ci`後に`npm run check`を実行する。
   - E2E Compose profileがAPI image、worker image、PostgreSQL、DynamoDB Local、ElasticMQ、RustFS、JWKS fixtureを起動する。
   - jscpdはSARIF reportをGitHub Code Scanningへuploadし、PRで重複のfileと位置を表示する。
   - OpenAPI JSON、仕様ルールカバレッジ表、静的解析reportをartifactとして保存する。

3. **main publish workflow**
   - Pull Requestと同じquality gateを実行する。
   - GitHub OIDCでAWS roleをassumeし、ECRへimageをpushする。
   - imageはcommit SHA tagとdigestをrelease manifestへ記録する。Sentry releaseもcommit SHAにする。

4. **VPS反映**
   - 開発チームはrelease manifestのdigestを指定してimageをpullする。
   - 同じdigestのmigration commandを一度実行する。
   - API containerを更新し、`/health/ready`を確認する。
   - worker containerを更新し、worker ready状態とSentry serviceを確認する。
   - rollbackは直前のimage digestへ戻す。migrationは既存APIとworkerが読めるschema変更を先に適用する。

GitHub ActionsのAWS roleはECR pushに必要な最小権限を持ち、trust policyは対象repositoryとmain publish workflowを条件にする。外部actionはcommit SHAを指定してworkflowに記録する。
