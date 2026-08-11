# API feature module アーキテクチャ設計

## 目的

新規開発者が機能の入口からHTTP契約、処理、外部サービス接続、永続化、テストを追跡できるAPI構成を提供する。

## 構成

```text
apps/api/src/
├── modules/
│   ├── health/
│   ├── auth/
│   │   ├── contracts.ts
│   │   ├── errors.ts
│   │   ├── provider.ts
│   │   ├── routes/
│   │   ├── use-cases/
│   │   └── index.ts
│   └── owners/
│       ├── contracts.ts
│       ├── repository.ts
│       ├── types.ts
│       └── index.ts
├── infrastructure/
│   ├── cognito/
│   ├── database/
│   │   ├── client.ts
│   │   ├── schema/
│   │   └── repositories/
│   ├── observability/
│   └── config/
├── shared/http/error-contract.ts
├── app.ts
├── index.ts
├── instrument.ts
└── server.ts
```

## 責務

### Module

moduleは利用者が認識する機能を表す。routeはHTTP method、path、入力契約、use case呼び出し、HTTP responseを担当する。use caseは機能の処理順序と結果を担当し、module内のproviderまたはrepository interfaceへ依存する。moduleの`index.ts`は公開するroute登録と依存型を明示する。

`auth`はCognitoで提供するSign Up、Sign In、OTP確認を扱う。`owners`はOwnerの識別、型、永続化interfaceを扱う。認証結果からOwnerを解決する処理は両moduleのinterfaceを合成するuse caseとして表す。

### Infrastructure

infrastructureはAWS SDK、Drizzle、PostgreSQL、Pino、Sentry、環境設定の具象実装を提供する。Cognito adapterはauth provider interfaceを実装する。Drizzle repositoryはOwner repository interfaceを実装する。

### Shared

sharedは複数moduleが同じ意味で利用するHTTP error契約を提供する。機能固有のschema、field、状態は各moduleが保持する。

### Composition root

`index.ts`は設定、adapter、repository、use case、routeを生成して接続する。`app.ts`はHono application、共通middleware、OpenAPI、module routeのmountを提供する。module routeは`app.route()`で登録する。

## 依存方向

```text
HTTP route -> use case -> module interface <- infrastructure adapter
     |             |
 module contract   module types

composition root -> all concrete dependencies
```

- use caseはHono、AWS SDK、Drizzle、`infrastructure`をimportしない。
- module contractはAPIのZod/OpenAPI schemaを保持する。
- database infrastructureのschemaはDrizzle table定義を保持する。
- infrastructureはmodule interfaceを実装し、moduleはinfrastructureの具象型を参照しない。
- appとcomposition rootは組み立てを担当し、機能処理を保持しない。

## Route module

- endpoint moduleはURLの語順に対応するファイル名を持つ。
- route定数は`…Route`、個別登録関数は`register…Route`、機能の集約登録関数は`register…Routes`を使用する。
- 個別moduleは一つのmethodとpathに対応する契約とhandlerを持つ。
- routeは検証済み入力を受け取り、use caseの結果を公開responseへ変換する。
- OpenAPI、validation、成功response、各error response、route契約テストを同じHTTP契約として更新する。

## テスト構成

```text
apps/api/test/
├── modules/
│   ├── auth/
│   ├── health/
│   └── owners/
└── infrastructure/
    ├── cognito/
    ├── database/
    └── observability/
```

- module routeは`app.request()`で公開HTTP契約を検証する。
- use caseはproviderとrepositoryのtest doubleを使い、機能の結果と呼び出しを検証する。
- infrastructureは外部技術との変換、query、設定を検証する。
- composition testはmodule routeが一度登録され、実際の依存が接続されることを検証する。

## 移行条件

- 公開method、path、status、request、response、OpenAPIを維持する。
- 現在の45件のAPIテストを移行後の機能・infrastructure構成へ対応付ける。
- `drizzle.config.ts`は移行後のdatabase schemaを参照する。
- `npm test`、`npm run check`、OpenAPI契約検証が成功する。

## 参照資料

- Hono公式のBest Practices、Routing、Testingを実装前に確認する。
