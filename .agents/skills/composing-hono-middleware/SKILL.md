---
name: composing-hono-middleware
description: Hono appのmiddleware、OpenAPIHono hook、notFound、onError、認証gateを追加、並べ替え、変更するときに使用する。request ID、body limit、logging、Sentry、validation error、横断的関心事のfeature非依存境界と実行順序を扱う。
---

# Hono middleware のcomposition

全requestに共通する処理を順序付きpipelineとして構成する。横断的コードはprotocolとapplication共通契約だけを知り、feature、field、use caseの知識を持たない。

## 必読資料

実装前に最新のHono middleware guideとconceptを読み、変更するbuilt-inまたはthird-party middlewareの公式pageも読む。URL、登録順、path scope、early response、context値をsession log、設計書、またはPRへ記録する。

- Middleware guide: <https://hono.dev/d%6Fcs/guides/middleware>
- Middleware concept: <https://hono.dev/d%6Fcs/concepts/middleware>
- Built-in middleware: <https://hono.dev/d%6Fcs/middleware/builtin/>
- Third-party middleware: <https://hono.dev/d%6Fcs/middleware/third-party>

## 配置

- `src/app.ts`: middleware登録順、OpenAPIHono `defaultHook`、`notFound`、`onError`、公開/保護routeのmount
- `src/infrastructure/observability/`: logger、request logging、Sentry middleware実装
- `src/infrastructure/cognito/`: access token verifier実装
- `src/shared/http/error-contract.ts`: 共通HTTP error schema
- `src/modules/<feature>/`: field schema、機能error、route固有response

middleware factoryは必要なlogger、verifier、configを引数で受け取る。handler内で具象依存を生成しない。

## 実行順を設計する

Hono middlewareは登録順に入り、`await next()`後は逆順に戻る。次の順序を基準に、対象middlewareが必要とするcontextと、失敗responseを観測すべき外側処理を確認する。

1. Sentry request isolation
2. request ID生成または受理
3. request IDのresponse header/Sentry関連付け
4. secure headersとCORS
5. request-scoped loggerとcompletion log
6. JSON body limit
7. 公開route
8. 保護routeのauthentication
9. feature route

`defaultHook`はOpenAPIHono生成時、`notFound`と`onError`はroot appへ一度設定する。loggingは413、401、validation、404、500を含む完了statusを記録できる外側に置く。

## Context値

typed Hono Environmentで横断値を定義する。

- `requestId`: request ID middlewareが設定する。
- `logger`: request IDをbindしたrequest-scoped logger。
- `principal`: authentication middlewareが検証済みCognito subjectなど最小の主体を設定する。

featureのOwner、Dog、Walk、request body fieldを横断Contextへ追加しない。feature route/use caseがprincipalから必要なmodule dataを解決する。

## 共通failure response

- body limit: HTTP 413、`PAYLOAD_TOO_LARGE`、`Request body exceeds the allowed size.`、request ID、`retryable: false`
- authentication gate: HTTP 401、`UNAUTHENTICATED`、`Authentication is required.`、request ID、`retryable: false`
- validation hook: HTTP 400、`INVALID_INPUT`、`入力内容を確認してください。`、request ID、`retryable: false`
- not found: HTTP 404、`NOT_FOUND`、`The requested resource was not found.`、request ID、`retryable: false`
- unexpected error: HTTP 500、`INTERNAL_ERROR`、`An unexpected error occurred.`、request ID、`retryable: false`

予期しないerrorをlog/Sentryへ渡し、公開responseへ内部messageやstackを含めない。期待される4xxは通常のHTTP結果として記録する。

## 横断処理をfeature非依存に保つ

`defaultHook`、`app.use`、`onError`、`notFound`はfield名、feature名、endpoint path、use case errorで分岐しない。

| 変更 | 担当 |
| --- | --- |
| Dog request fieldとissue message | Dogs module contract |
| auth provider結果から機能errorへの変換 | auth adapter/use case |
| auth機能errorからHTTP responseへの変換 | auth route |
| 全route共通error envelope | root hook/handler |
| client表示message | clientのerror code mapping |

新しいfieldまたはfeature routeを追加するとき、共有hook/middlewareは変更しない。全routeの共通契約を変更する判断だけがroot hook/handlerを変更する。

## 公開routeと保護route

`/health`、`/openapi.json`、公開auth flowを公開routeとしてmountする。認証済みfeature routeはauthenticationを登録したchild app/groupへmountする。rootの`/v1/*`認証に公開path例外を列挙する構成を作らない。

## Test-first workflow

1. middlewareごとの前提context、path scope、early response、post-response処理をtestで定義する。
2. 公式資料を読み、登録順と判断を記録する。
3. middlewareを一つずつ追加し、前後関係をrequest testで確認する。
4. 200、400、401、404、413、500でrequest ID、log、secure headerを検証する。
5. 公開routeと保護routeの認証境界を検証する。
6. 新しいfeature field/errorを追加するscenarioで共有middlewareが変更不要なことを確認する。
7. Sentry capture、log redaction、型検査、lintを確認する。

## 完了条件

- middleware順序とpath scopeが明示される。
- context値がproducerより後で消費される。
- 共通failureが共有error契約に一致する。
- 横断処理がfield、feature、use case知識を持たない。
- feature追加が共有middlewareの変更を必要としない。
- 公開routeと保護routeが認証境界で分かれる。
- middleware/HTTP test、型検査、lintが成功する。
