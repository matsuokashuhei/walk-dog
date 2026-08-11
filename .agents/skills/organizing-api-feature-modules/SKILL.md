---
name: organizing-api-feature-modules
description: Node.js APIの機能を追加、分割、移動するときに、module、infrastructure、shared、composition rootの配置と依存方向を設計する。Hono route、use case、Zod契約、repository interface、Drizzle実装、AWS adapter、機能別testの置き場所を判断するときに使用する。
---

# API feature module の構成

新規開発者が機能名から関連コードを追跡できる構成を作る。最初に機能境界を決め、外部技術をinfrastructureへ分離し、composition rootで接続する。

## 配置を決める

| 対象 | 配置 | 責務 |
| --- | --- | --- |
| Hono route、Zod/OpenAPI契約、use case、provider/repository interface、機能型 | `src/modules/<feature>/` | 利用者が認識する機能と、その機能が要求する能力 |
| AWS SDK、Drizzle、PostgreSQL、Pino、Sentry、環境設定の具象実装 | `src/infrastructure/<technology>/` | 外部技術との接続とmodule interfaceの実装 |
| 複数moduleが同じ意味で使う小さな契約 | `src/shared/` | 機能に依存しない共有表現 |
| 依存の生成と接続 | `src/index.ts` | config、adapter、repository、use case、routeの組み立て |
| Hono applicationとmodule routeのmount | `src/app.ts` | 共通middleware、OpenAPI、`app.route()`による登録 |

機能固有のfield、schema、error、状態をmoduleへ置く。`shared`への移動は、複数moduleが同じ意味と変更理由で利用する時点で行う。

## Moduleを構成する

```text
src/modules/<feature>/
├── contracts.ts
├── errors.ts
├── provider.ts または repository.ts
├── types.ts
├── routes/
├── use-cases/
└── index.ts
```

必要なファイルだけを作る。

- `contracts.ts`: 公開APIのZod/OpenAPI request、response、parameter schema
- `errors.ts`: use caseが返す機能固有error
- `provider.ts`: 外部サービスへ要求する能力のinterface
- `repository.ts`: 永続化へ要求する能力のinterface
- `types.ts`: HTTPや外部SDKに依存しない機能型
- `routes/`: methodとpathごとのHTTP契約とhandler
- `use-cases/`: 機能処理の順序、入力、結果
- `index.ts`: moduleが公開するroute登録関数、依存型、機能型

## 依存方向を保つ

```text
route -> use case -> module interface <- infrastructure implementation
composition root -> concrete dependencies
```

- routeは検証済みrequestをuse case入力へ変換し、結果をHTTP responseへ変換する。
- use caseはHono、AWS SDK、Drizzle、`infrastructure`をimportしない。
- infrastructureはmoduleのproviderまたはrepository interfaceを実装する。
- Drizzle tableは`src/infrastructure/database/schema/`へ置く。
- API契約とDB rowを別の型として扱い、route、use case、repositoryで意味の変換点を明示する。
- concrete class、client、connection lifecycleをcomposition rootで生成する。

## 機能境界を判断する

routeのURLだけでmoduleを分けず、利用者が認識する能力と変更理由で分ける。認証操作は`auth`、Owner profileとOwner永続化は`owners`として扱う。二つの能力を使う処理は、一方のuse caseが両方のinterfaceを受け取る形で合成する。

横断処理は機能知識を持たせず、request ID、logging、Sentry、汎用HTTP error整形のような全route共通の状態だけを扱う。

## テストを対応付ける

- `test/modules/<feature>/`: route契約とuse caseの結果
- `test/infrastructure/<technology>/`: adapter、repository、設定、外部表現との変換
- application composition test: module routeの一意なmountと具象依存の接続

既存testを移動するときは、公開method、path、status、request、response、OpenAPIを同じ期待値で維持する。

## ワークフロー

1. 追加する能力、入力、結果、状態遷移を機能名で定義する。
2. moduleが必要とするproviderとrepositoryのinterfaceを定義する。
3. route、contract、use case、機能型をmoduleへ配置する。
4. 外部技術の具象実装をinfrastructureへ配置する。
5. composition rootで具象依存を生成し、module routeを`app.route()`で一度mountする。
6. module test、infrastructure test、composition testを追加する。
7. importを確認し、use caseからHono、AWS SDK、Drizzle、infrastructureへの依存がないことを検証する。

## 例

Dogs機能では、`modules/dogs/contracts.ts`に公開schema、`modules/dogs/repository.ts`に永続化interface、`modules/dogs/use-cases/`に一覧と作成処理、`modules/dogs/routes/`にGETとPOSTを置く。Drizzle実装は`infrastructure/database/repositories/dog-repository.ts`、S3実装は`infrastructure/s3/`に置き、`index.ts`で接続する。
