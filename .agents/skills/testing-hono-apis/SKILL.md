---
name: testing-hono-apis
description: Hono APIのroute、use case、middleware、OpenAPI、composition、server、Cognito adapter、Drizzle repositoryのtestを追加、移動、変更するときに使用する。`app.request()`、Node.js test runner、test double、feature-first配置、再帰的test discovery、挙動維持baselineを扱う。
---

# Hono API のtest

公開HTTP契約と各内部境界を別のtestで検証する。testの配置をproductionのmodule/infrastructure境界へ対応させ、失敗時に原因の責務が分かるsuiteを作る。

## 必読資料

実装前にHono公式Testing GuideとTesting Helper、Node.js Test Runnerを読む。URL、`app.request()`または`testClient()`の選択、test discovery、外部依存の扱いをsession log、設計書、またはPRへ記録する。

- Hono Testing: <https://hono.dev/d%6Fcs/guides/testing>
- Testing Helper: <https://hono.dev/d%6Fcs/helpers/testing>
- Node.js Test Runner: <https://nodejs.org/api/test.html>

## 配置

```text
test/
├── modules/
│   └── <feature>/
│       ├── routes/
│       ├── use-cases/
│       └── <feature>-routes.test.ts
├── infrastructure/
│   ├── cognito/
│   ├── database/
│   └── observability/
├── app.test.ts
├── composition.test.ts
├── config.test.ts
└── server.test.ts
```

共有fixtureは`test/support/`または対象featureの`fixtures.ts`へ置く。`features/`、`platform/`という別の第一分類をtestだけに導入しない。

## Route契約test

一つのendpoint testは対応する`register…Route`をtest appへ直接登録し、listenerを起動せず`app.request()`で検証する。

到達可能なuse case result/errorごとにstatus、`code`、`message`、`requestId`、`retryable`を対応付けたoutcome-to-HTTP matrixを定義する。statusが同じでも、到達可能なresult-union memberごとにroute caseを1件置く。

- success statusと完全な公開response
- missing、malformed、境界値を含む入力不正
- matrixの各reachable outcomeに対応するHTTP case
- `code`、`message`、`requestId`、`retryable`
- dependencyが受け取る検証済みinput
- invalid requestでuse caseが呼ばれないこと

route testへ渡すdoubleはuse case関数だけにする。AWS SDK clientやDrizzle chainをroute testでmockしない。

## Use case test

use caseを直接呼び、provider/repositoryのtyped fakeで次を検証する。

- dependency引数と呼び出し順序
- success result
- 各既知result/error
- failure後に後続dependencyが呼ばれないこと
- 予期しないerrorの伝播
- Hono、AWS SDK、Drizzle、infrastructureをimportしない境界

## Infrastructure test

- adapter: recording SDK senderでcommand input、output変換、documented exception mapping、未知error伝播を検証する。
- repository: schema/query/mapper/constraint/transactionを検証する。実PostgreSQLが必要な同時実行testはintegration commandで実行する。
- observability/middleware: 最小Hono appでrequest ID、log、Sentry、redaction、early responseを検証する。
- config: environment inputからtyped configへの変換を検証する。

integration cleanupは、row cleanupが失敗してもPoolなどの所有handleを閉じる。cleanupの失敗位置でもcloseが実行されることをassertする。

SDKまたはquery builderの巨大な部分mockを作らず、module interfaceまたは小さなsender/transaction境界をfakeにする。

## Aggregate、OpenAPI、composition

- `<feature>-routes.test.ts`: `register…Routes`が各endpointを一度登録することをOpenAPI path/methodで確認する。
- `app.test.ts`: 共通middleware、health、not-found、global error、module mountを確認する。
- OpenAPI test: 生成されたpath-to-method mapと期待集合の完全一致、version、operation、request/responseのrequiredとnullable、component、security schemeを確認する。
- `composition.test.ts`: factory順序、同一client/DB instanceの伝播、use case/route注入、import時の副作用を確認する。
- entry境界: import-only完了とdirect entry起動を別subprocessの観測結果で証明する。
- `server.test.ts`: listener→Pool→外部client→observabilityのclose順序、各一回、冪等shutdown、signal、および各failure位置でも後続closeが実行されることを確認する。

同じHTTP response caseをaggregate、composition、endpoint testで繰り返さない。各testは自身の境界だけを詳しく検証する。

## Test discovery

feature-firstのnested fileを全て実行するrecursive patternをpackage scriptへ設定する。shellがglobを事前展開しないようpatternをquoteし、Node/tsx test runnerへ渡す。

```json
{
  "test": "node --import tsx --test \"test/**/*.test.ts\"",
  "test:integration": "node --import tsx --test \"test/**/*.integration.ts\""
}
```

実DBなどのintegration suiteは`*.integration.ts`で命名し、defaultの`*.test.ts`と分ける。終了codeに加えてTAP summaryとtest名一覧でdiscoveryを確認する。

## 挙動維持migration

構成変更では二段階で検証する。

1. 既存testを移動し、test名、assertion、件数を維持した状態でrecursive discoveryを通す。
2. use case、adapter、repository、aggregate、compositionなど新しい境界testを追加し、既存test名が全て残ることと新しい総数を記録する。

walk-dog APIのPR2 baselineは45件である。移行前後のmethod、path、status、request、response、OpenAPIを比較する。

## Test-first workflow

1. 変更する境界を一つ選び、失敗する最小testを先に書く。
2. 対象境界に合う小さなtyped doubleを作る。
3. 最小実装で対象testを通す。
4. 対象suite、関連suite、全default suiteを順に実行する。
5. integrationが必要なquery/constraint/concurrencyを実環境で検証する。
6. test discovery、元のbaseline名、総数、型検査、lintを確認する。

## 完了条件

- test配置がmodulesとinfrastructureの責務へ対応する。
- route testがreachable outcome-to-HTTP matrixと各outcomeのHTTP caseを持ち、use case testが処理順序、infrastructure testが技術変換とcleanup時のhandle closeを検証する。
- aggregate、OpenAPI path-to-method完全一致、required/nullable、composition、subprocess entry、server failure-positionの重複しないtestがある。
- nested testがrecursive discoveryで実行される。
- 挙動維持migrationで既存baseline test名とassertionが残る。
- 対象test、全test、型検査、lintが成功する。
