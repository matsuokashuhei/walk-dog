---
name: routing-hono-apis
description: HonoのHTTP handler、method、path、`app.route()`構成、endpoint moduleの命名と責務を追加または変更するときに使用する。feature moduleのroute分割、route集約、use case呼び出し、ContextとHonoRequest、HTTPException、公開responseを扱う。
---

# Hono API のルーティング

Hono APIの公開HTTP契約を保ちながら、各endpointのhandler、名前、責務、依存関係をmethodとpathへ対応させる。ランタイムはNode.jsとする。

## 必読資料

変更対象に対応する最新のHono公式資料を実装前に読み、URLとrouting判断をsession log、設計書、またはPRへ記録する。

- Hono application: <https://hono.dev/d%6Fcs/api/hono>
- Routing: <https://hono.dev/d%6Fcs/api/routing>
- Context: <https://hono.dev/d%6Fcs/api/context>
- HonoRequest: <https://hono.dev/d%6Fcs/api/request>
- HTTPException: <https://hono.dev/d%6Fcs/api/exception>
- Best Practices: <https://hono.dev/d%6Fcs/guides/best-practices>

## 公開HTTP契約を定義する

method、完全な公開path、入力、成功statusとresponse、各error statusとresponseを最初に確定する。公開契約は`$documenting-hono-openapi`、入力検証は`$validating-hono-requests`と同じmodule contractを使う。

- 成功時は文書化したJSONを返す。
- error時は`code`、`message`、`requestId`、`retryable`を持つ共有JSONを返す。
- path parameterとqueryはhandlerに結び付いた型付きアクセスを使う。
- handler内で使用する値は`Context`と`HonoRequest`の公開APIから取得する。

## Endpoint moduleを構成する

一つのendpoint moduleを一つのmethodとpathへ対応させる。

| 対象 | 規則 |
| --- | --- |
| ファイル | URLの語順を保つ。`/auth/sign-in/verify`は`sign-in-verify.ts` |
| route定数 | `signInVerifyRoute`のような`…Route` |
| 個別登録関数 | `registerSignInVerifyRoute`のような`register…Route` |
| 機能集約関数 | `registerAuthRoutes`のような`register…Routes` |

endpoint moduleへ置く責務は次のとおり。

1. OpenAPI route定義をmoduleの`contracts.ts`から組み立てる。
2. 検証済みrequestを`c.req.valid()`で取得する。
3. requestとContextの値をuse case入力へ変換する。
4. use caseを一度呼び出す。
5. use caseの結果または機能errorを文書化済みHTTP responseへ変換する。

認証provider呼び出し、token解析、Owner解決、永続化、transactionをhandlerへ置かない。これらをmoduleのuse caseとinterface、infrastructure実装へ分ける。

## Routeを集約する

- `src/modules/<feature>/routes/index.ts`は個別登録関数を呼び、機能のroute appを返す。
- `src/modules/<feature>/index.ts`は機能のroute登録と必要な依存型を公開する。
- `src/app.ts`は構築済みroute appを`app.route()`で一度mountする。
- child appへrouteを登録してから親appの`app.route()`を呼ぶ。
- mount prefixとchild pathを合わせて完全な公開pathを一意にする。

Honoの型推論を保つため、pathとhandlerをroute module内で宣言し、HTTP処理を汎用controller classへ移さない。

## 判断表

| 変更 | 配置 | 関連skill |
| --- | --- | --- |
| method、path、handler、route登録 | featureの`routes/` | このskill |
| request/response/error schema | featureの`contracts.ts` | `$documenting-hono-openapi` |
| request validation | route境界 | `$validating-hono-requests` |
| 機能処理の順序 | featureの`use-cases/` | `$implementing-api-use-cases` |
| 共通middleware | `app.ts`とinfrastructure | `$composing-hono-middleware` |
| route契約test | `test/modules/<feature>/` | `$testing-hono-apis` |

## ワークフロー

1. 現在のroute、集約module、mountを読み、methodと完全なpathを一覧にする。
2. 公式資料を読み、method、path、Context/HonoRequestの使用、composition判断を記録する。
3. endpoint file、route定数、個別登録関数、機能集約関数を命名する。
4. contract、validation、use case、HTTP変換の境界を実装する。
5. feature routeを組み立て、`app.route()`で一度mountする。
6. `$testing-hono-apis`で成功、文書化した各error status、入力不正を検証する。
7. OpenAPIのmethod/path、型検査、lint、routeの一意な登録を確認する。

## 完了条件

- endpoint file、route定数、個別登録関数、機能集約関数が公開URLと対応する。
- handlerがHTTP変換とuse case呼び出しを担当する。
- OpenAPIとruntime validationが同じmodule contractを参照する。
- 成功、各error status、入力不正のroute契約testが成功する。
- 各endpointが一度登録され、公開pathとmethodがOpenAPIへ含まれる。
- 型検査とlintが成功する。
