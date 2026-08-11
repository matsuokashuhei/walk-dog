---
name: implementing-api-use-cases
description: Node.js APIの機能処理をuse caseとして追加または変更するときに使用する。入力、結果、機能error、provider/repository interface、処理順序、transaction境界、routeとの変換をHono、AWS SDK、Drizzleから独立して設計・実装する。
---

# API use case の実装

use caseを機能処理の順序と結果の境界にする。HTTPと外部技術の詳細をinterfaceの外側へ置き、test doubleで直接検証できる形にする。

## 配置

- use case: `src/modules/<feature>/use-cases/<action>.ts`
- input、result、機能型: `src/modules/<feature>/types.ts`またはuse case file
- 機能error: `src/modules/<feature>/errors.ts`
- provider interface: `src/modules/<feature>/provider.ts`
- repository interface: データを所有するmoduleの`repository.ts`
- unit test: `test/modules/<feature>/use-cases/<action>.test.ts`

別moduleが所有するデータは、そのmoduleの公開interfaceへ依存する。認証処理がOwnerを解決するときは、auth use caseがowners moduleのrepository interfaceを受け取る。

## 入力と結果を定義する

inputは検証済みのprimitiveと機能型で構成する。Hono `Context`、`Request`、Zod parse result、AWS command、Drizzle rowを含めない。

resultは成功値と、呼び出し側が処理できる機能errorを明示する。判別可能なunionまたは機能error classを一貫して使う。HTTP status、response message、request IDはrouteが割り当てる。

```ts
type VerifySignInResult =
  | { ok: true; authentication: Authentication }
  | { ok: false; error: VerifySignInError }
```

予期しない障害は共通application error handlerへ到達させる。providerが返す既知の結果はmodule errorへ変換してからuse caseへ渡す。

## 依存interfaceを定義する

use caseが必要とする能力を、小さなmethodとしてmodule側に定義する。

- provider interfaceはCognito、S3、SQSなど外部能力の意味を表す。
- repository interfaceはOwner、Dog、Walkなどmoduleデータの操作を表す。
- parser、clock、ID生成器は機能が要求する意味でinterface化する。
- AWS SDKやDrizzleの型をinterface signatureへ公開しない。

具象adapterとrepositoryは`src/infrastructure`に置き、`src/index.ts`で注入する。

## 処理順序を実装する

1. inputと依存を明示的に受け取る。
2. providerまたはrepositoryを機能順序どおりに呼ぶ。
3. 既知の結果を機能errorへ収束させる。
4. 後続処理に必要な値だけを渡す。
5. 成功resultをmodule型で返す。

use case fileがimportできるのは、moduleの型、error、interfaceと、連携する別moduleの公開interfaceである。Hono、Zod、AWS SDK、Drizzle、PostgreSQL client、`infrastructure`をimportしない。

## Transaction境界を決める

複数の永続化操作を一つの整合性単位にする責務をrepository methodへ置く。外部network callをdatabase transaction内で実行しない。

複数repositoryを跨ぐ状態遷移が一つのtransactionを必要とする場合は、機能のtransaction interfaceを定義し、infrastructureが同じdatabase transactionで実装する。use caseへDrizzle transaction objectを渡さない。

## Routeと変換する

routeは検証済みrequestと認証済み主体をuse case inputへ変換し、use case resultを文書化したHTTP responseへ変換する。use caseはmethod、path、status、header、error envelopeを知らない。

## Test-first workflow

1. input、success result、各機能error、依存呼び出し順序をtestで定義する。
2. provider/repositoryの小さなtest doubleを作る。
3. use caseを最小実装する。
4. success時の引数、順序、戻り値を検証する。
5. 各既知resultで後続依存が呼ばれないことを検証する。
6. 予期しない依存errorが共通handlerへ伝播することを検証する。
7. importを確認し、frameworkとinfrastructureへの依存がないことを検証する。

## 完了条件

- inputとresultがframework非依存の型である。
- 必要な能力がmodule interfaceとして表現される。
- use caseが機能処理の順序と既知の結果を一箇所で扱う。
- transactionが整合性を所有するinfrastructure methodの内側にある。
- Hono、Zod、AWS SDK、Drizzle、infrastructureのimportがない。
- success、各機能error、依存未呼び出し、予期しないerrorのunit testが成功する。
