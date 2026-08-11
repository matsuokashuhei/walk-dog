---
name: composing-api-dependencies
description: Node.js APIのconfig、client、adapter、repository、use case、Hono route、app、serverをcomposition rootで生成・接続するときに使用する。依存生成順、instance共有、route mount、resource lifecycle、graceful shutdown、composition testを追加または変更する。
---

# API dependency のcomposition

具象依存を一つのcomposition rootで組み立てる。moduleとinfrastructureはfactoryまたはconstructorで依存を受け取り、production object graphを`src/index.ts`だけが知る構成にする。

## ファイル責務

| File | 責務 |
| --- | --- |
| `src/index.ts` | config読込、client、adapter、repository、use case、route、appの生成と接続 |
| `src/app.ts` | Hono application、共通middleware、OpenAPI、完成済みmodule routeのmount |
| `src/server.ts` | Node listener起動、signal、graceful shutdown |
| `src/infrastructure/config/` | 環境入力から型付きconfigへの変換 |
| `src/infrastructure/<technology>/client.ts` | 長寿命clientの生成 |
| `src/modules/<feature>/index.ts` | module route factoryと必要な依存型の公開 |

別の`container`やservice locatorを追加せず、明示的なfactory引数で接続する。object graphが大きくなった場合は`index.ts`から小さな純粋composition factoryを抽出し、production entryがそれを一度呼ぶ。

compositionの都合で別の第一分類を作らない。moduleのprovider/repository interface、use case、routeは`src/modules/<feature>/`に置き、Cognito adapterは`src/infrastructure/cognito/`、Drizzle repositoryは`src/infrastructure/database/repositories/`に置く。`modules/<feature>/infrastructure`、`features/`、`application/`、`http/`という新しい分類へ置き換えない。

## 構築順

1. process environmentからconfigを一度loadする。
2. loggerとobservabilityを生成する。
3. PostgreSQL Pool、Drizzle DB、AWS SDK clientなどprocess lifetime resourceを生成する。
4. clientを共有するadapterとrepositoryを生成する。
5. module interfaceとしてuse caseへ注入する。
6. use caseをfeature route factoryへ注入する。
7. 完成済みfeature routeを`app.ts`へ渡す。
8. `app.route()`で各feature routeを一度mountする。
9. serverを起動する。

route callbackやrequest handler内でclient、adapter、repositoryを生成しない。

## Instanceとlifecycleを所有する

- region、credential、endpoint、lifecycleが同じAWS adapterは一つの長寿命clientを共有する。
- repositoryは一つのDrizzle DB/Poolを共有する。
- Drizzle DBがPoolのviewである場合、Poolをclose対象にする。
- server shutdownは新規受付を止め、処理中listenerを閉じてからPool、AWS client、observabilityを閉じる。
- shutdownは同じPromiseを返す形で冪等にし、各resourceを一度閉じる。
- adapter、repository、use case、routeは注入されたprocess resourceを閉じない。

## Appとmoduleを接続する

feature route factoryはuse caseだけを受け取る。`app.ts`はDB、AWS client、SDK configを受け取らない。

```text
config -> clients -> adapters/repositories -> use cases -> feature routes
                                                       -> app.route()
```

child appへendpointを登録してから`app.route()`でmountする。mount prefixとchild pathを組み合わせた公開method/pathを一意にする。

## Test seam

production internal instanceをgetterで公開しない。composition factoryへfactory集合を注入し、testではspy factoryでobject identityと順序を確認する。

公開可能なseam:

- module use case factory
- feature route factory
- app factory
- production composition factoryとfactory型
- server startupへ渡すplatform operation

production defaultを持つfactory集合はtestでAWS/PG接続を作らずに差し替えられる。

## Test-first workflow

1. object graphと各resourceのownerを図またはtestで定義する。
2. factoryの呼び出し順と同一instance伝播のcomposition testを書く。
3. client、adapter、repository、use case、route、appを順に接続する。
4. module endpointがmount pathから一度到達できることをtestする。
5. signalとshutdownの順序、冪等性、各close一回をtestする。
6. `index.ts` importが意図しないlistenerや接続をtest環境で作らない構成を確認する。

## 完了条件

- production具象依存の生成がcomposition rootへ集約される。
- moduleとappがAWS SDK、Drizzle、Poolを受け取らない。
- process resourceが一度生成され、必要なadapter/repositoryへ同じinstanceが渡る。
- feature routeが一度mountされる。
- shutdown順序とclose一回が成立する。
- composition test、server test、対象HTTP test、型検査、lintが成功する。
