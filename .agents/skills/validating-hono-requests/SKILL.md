---
name: validating-hono-requests
description: Hono APIのjson、query、param、header、cookie、form入力をZod、`@hono/zod-openapi`、validatorで検証するときに使用する。feature moduleのschema配置、検証済み値のuse case受け渡し、共通validation error response、field固有messageを追加または変更する。
---

# Hono request のvalidation

公開requestをroute境界で検証し、型付きの検証済み値だけをuse caseへ渡す。ランタイムはNode.jsとする。

## 必読資料

実装前に最新のHono Validation guideを読み、failure responseを変更するときはvalidator error handling exampleも読む。URL、validation target、schema owner、failure responseをsession log、設計書、またはPRへ記録する。

- Validation: <https://hono.dev/d%6Fcs/guides/validation>
- Error handling example: <https://hono.dev/examples/validator-error-handling>

## Schemaとtargetを決める

- 公開APIの機能固有schemaを`src/modules/<feature>/contracts.ts`へ置く。
- `json`、`query`、`param`、`header`、`cookie`、`form`から対象targetを選ぶ。
- 文書化されたendpointは`@hono/zod-openapi`のroute定義へ同じschemaを渡す。
- JSONとformは対応する`Content-Type`をrequest条件として扱う。
- fieldの形状とcheckは`$zod:defining-zod-schemas`、refinementとtransformは`$zod:transforming-zod-schemas`、issue messageは`$zod:handling-zod-errors`で変更する。

OpenAPI用とruntime用にschemaを複製しない。Drizzle schemaをrequest validationへ流用しない。

## Route境界を保つ

handlerは`c.req.valid('<target>')`から検証済み値を取得する。raw body、Zod result、Hono `Context`をuse caseへ渡さない。

```ts
const input = c.req.valid('json')
const result = await createDog({
  ownerId: c.get('ownerId'),
  ...input,
})
```

schemaのtransform後の値をuse case入力にする。認証済み主体やrequest IDのようなContext値は、検証済みinputと明示的に合成する。

## Error責務を分ける

- schemaはfield、許容値、正規化、field固有issue messageを持つ。
- OpenAPIHonoの共通validation hookはZod issueを共有HTTP errorへ変換する。
- 共有errorはHTTP 400、`code: "INVALID_INPUT"`、`message`、`requestId`、`retryable: false`を持つ。
- 共通hookはfeature名、field名、endpoint path、個別use caseを条件分岐に持たない。
- routeはvalidation成功後のHTTP変換を担当する。

新しいfieldはmodule schemaとそのtestを追加して提供する。共通hookの変更は共有error contract自体が変わる場合に行う。

## Validationと機能errorを区別する

requestの形状、型、format、許容値はvalidationで表す。Owner境界、名前の一意性、状態遷移、外部provider結果はuse caseとrepository/providerの結果として扱う。

| 状態 | 担当 |
| --- | --- |
| 必須field、文字列長、enum、format | module Zod schema |
| 複数field間の入力整合 | module Zod refinement |
| 認証済みOwner | authentication middlewareとroute入力合成 |
| Owner内一意性、現在状態 | use caseとrepository |
| validation error envelope | 共通OpenAPIHono hook |

## ワークフロー

1. accepted inputとvalidation targetを仕様から抽出する。
2. 公式資料を読み、package、target、Content-Type、failure responseを記録する。
3. moduleのcontract schemaをtest-firstで追加または変更する。
4. OpenAPI routeへ同じschemaを接続する。
5. handlerで`c.req.valid()`を使い、検証済み値だけをuse caseへ渡す。
6. 共通hookが共有error responseへ変換することを確認する。
7. valid、各invalid class、Content-Type、use case未呼び出し、OpenAPIをtestする。

## 完了条件

- runtime validationとOpenAPIが同じmodule schemaを参照する。
- use caseが検証済みのframework非依存inputを受け取る。
- invalid requestが共有400 responseを返し、use caseを呼ばない。
- field追加がmodule schemaとtestで完結する。
- 共通hookがfeature固有の知識を持たない。
- `$testing-hono-apis`の対象test、型検査、lintが成功する。
