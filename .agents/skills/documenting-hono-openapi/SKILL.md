---
name: documenting-hono-openapi
description: Hono APIの公開契約を`@hono/zod-openapi`、`OpenAPIHono`、Zod schema、route定義、`/openapi.json`、BearerAuthで追加または変更するときに使用する。feature moduleのrequest、parameter、response、error schemaとOpenAPI operationを扱う。
---

# Hono OpenAPI の文書化

OpenAPIをrequest validation、response、モバイル型付きclient生成の正本として更新する。ランタイムはNode.jsとする。

## 必読資料

実装前に最新のHono公式Zod OpenAPI exampleとthird-party OpenAPI sectionを読み、URLと契約判断をsession log、設計書、またはPRへ記録する。API reference UIを追加するときはSwagger UIまたはScalar exampleも読む。

- Zod OpenAPI: <https://hono.dev/examples/zod-openapi>
- Third-party middleware: <https://hono.dev/d%6Fcs/middleware/third-party>

## 契約の配置

- 機能固有のrequest、parameter、response schemaを`src/modules/<feature>/contracts.ts`へ置く。
- 複数moduleが同じ意味で使うHTTP error schemaを`src/shared/http/error-contract.ts`へ置く。
- endpointの`createRoute()`定義を`src/modules/<feature>/routes/<endpoint>.ts`へ置く。
- OpenAPI metadata、`BearerAuth`、`GET /openapi.json`の登録を`src/app.ts`へ置く。
- Drizzle tableとDB row schemaをOpenAPI contractとして公開しない。

schema名は機能と表現を示す。Zod変数は`createDogRequestSchema`、OpenAPI componentは`CreateDogRequest`のように対応付ける。

## Operationを定義する

各endpointについて次を同時に定義する。

1. 完全な公開pathとHTTP method
2. tags、summary、operationId
3. path、query、header、JSON bodyの入力schema
4. 成功statusごとのmedia typeとresponse schema
5. 実装が返す各error statusと共有error schema
6. 認証済みrouteの`security: [{ BearerAuth: [] }]`

`/health`と`/openapi.json`は公開operationとして提供する。`BearerAuth`はHTTP bearer JWTと`bearerFormat: JWT`を持つ。

## Runtime validationと同じschemaを使う

request schemaを`createRoute({ request: ... })`へ直接渡し、同じrouteを`app.openapi(route, handler)`へ登録する。handlerは`c.req.valid()`から検証済み値を受け取る。OpenAPI専用schemaとruntime専用schemaを複製しない。

schema shapeを変更するときは`$zod:defining-zod-schemas`、validation responseを変更するときは`$validating-hono-requests`を使用する。standalone JSON Schema変換は`$zod:converting-zod-json-schema`で扱う。

## Error契約を揃える

各error responseは`code`、`message`、`requestId`、`retryable`を持つ共有schemaを参照する。status、code、message、retryableはroute handler、validation hook、global error handler、契約testと一致させる。

機能固有の失敗は共有shapeの`code`値とHTTP statusで表す。feature moduleは独自のerror envelopeを作らない。

## ワークフロー

1. 仕様と既存routeからmethod、path、入力、成功response、各error response、securityを一覧にする。
2. 公式資料を読み、採用するOpenAPI機能を記録する。
3. moduleの`contracts.ts`でschemaを定義し、必要なcomponent名を付ける。
4. endpoint routeでoperationを定義し、同じschemaをruntime validationへ接続する。
5. `src/app.ts`のdocument metadataとsecurity schemeを維持する。
6. handlerのbody/statusとdocumentのresponseを対応付ける。
7. `/openapi.json`のpath、method、request、response、component、securityをassertする。

## 完了条件

- `/openapi.json`が対象pathとmethodを一度含む。
- request schema、runtime validation、検証済みinputの型が同じ定義を使う。
- successと実装が返す全error statusがresponse schemaを持つ。
- protected routeが`BearerAuth`を持ち、公開routeが公開状態で表現される。
- schema component名と`$ref`が安定している。
- `$testing-hono-apis`のOpenAPI契約test、型検査、lintが成功する。
