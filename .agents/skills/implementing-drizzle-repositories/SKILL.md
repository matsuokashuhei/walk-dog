---
name: implementing-drizzle-repositories
description: Node.js APIのmodule repository interfaceをDrizzle PostgreSQLで実装または変更するときに使用する。repository配置、table rowとmodule型の変換、query、constraint、upsert、transaction、database error境界、integration testを扱う。
---

# Drizzle repository の実装

moduleが要求する永続化能力をDrizzleで実装する。databaseの型と制約をinfrastructure内へ閉じ込め、use caseへmodule型を返す。

## 必読資料

変更対象に対応する最新のDrizzle公式資料を読む。schemaは`$drizzle:defining-drizzle-schemas`、migrationは`$drizzle:migrating-drizzle-postgres`、queryは`$drizzle:querying-drizzle-sql`または`$drizzle:querying-drizzle-relations`を併用する。読んだURLとquery/transaction/constraint判断をsession log、設計書、またはPRへ記録する。

## 配置

- interface: `src/modules/<owner>/repository.ts`
- module型: `src/modules/<owner>/types.ts`
- Drizzle schema: `src/infrastructure/database/schema/<table>.ts`
- repository実装: `src/infrastructure/database/repositories/<entity>-repository.ts`
- database client型: `src/infrastructure/database/client.ts`
- integration test: `test/infrastructure/database/repositories/<entity>-repository.test.ts`

module interfaceはDrizzle table、query builder、transaction、`pg` errorを公開しない。

## Interfaceを実装する

repository classまたはfactoryはmodule interfaceを明示的に実装し、database clientをconstructor引数で受け取る。method名はSQL操作ではなく機能上の結果を表す。

```ts
interface OwnerRepository {
  findOrCreateByCognitoSubject(subject: string): Promise<Owner>
}
```

`selectOwnerRow`のような低水準helperはinfrastructure内に保持する。

## Rowをmodule型へ変換する

`typeof table.$inferSelect`から得るrowをprivate mapperでmodule型へ変換する。API responseへ直接変換しない。

- database column名とnullabilityをmoduleの意味へ対応付ける。
- timestampは`Date`のままmoduleへ返し、routeがISO文字列へ変換する。
- database固有のenum、JSON、numeric表現をmodule型へ明示的に変換する。
- insert inputとselect rowを公開API DTOとして再利用しない。

## Constraintを同時実行制御に使う

一意性はPostgreSQL constraintで成立させ、事前selectだけに依存しない。`onConflictDoNothing`または`onConflictDoUpdate`では対象constraint/columnを明示し、関係しないconstraint failureを隠さない。

find-or-createは、一つのrepository method内でinsert returningを試し、対象一意constraintの競合時に既存rowをselectする。既存rowを返す処理は意図した更新だけを行う。

## Transaction境界

一つの整合性結果を作る複数queryをrepository method内のtransactionへ置く。transaction objectをmodule interfaceまたはuse caseへ渡さない。

- network provider callをdatabase transaction内で実行しない。
- 複数repositoryを跨ぐtransactionは機能のtransaction interfaceをinfrastructureで実装する。
- isolation levelやlockが必要な場合は、成立させる状態遷移と同時実行条件を記録する。

## Error境界

constraintが表す期待可能な機能結果だけをmodule result/errorへ変換する。connection failure、予期しないconstraint、transaction failure、不変条件違反はinfrastructure failureとして伝播させ、共通application error handlerへ到達させる。

catch-and-requery、error code分岐、retryは、対象のPostgreSQL/Drizzle挙動と機能契約が必要とするときだけ追加する。

## Test-first workflow

1. module interfaceの成功結果と期待可能errorをtest doubleで確定する。
2. schema constraintとmigration SQLを確認する。
3. repository integration testを実DB向けに先に追加する。
4. mapper、query、conflict、transactionを最小実装する。
5. 新規row、既存row、同時実行、一意性、mappingを検証する。
6. 予期しないdatabase failureが変換されず伝播することを検証する。
7. query、migration、型検査、lintを実行する。

## 完了条件

- repositoryがmodule interfaceを実装し、module型を返す。
- DrizzleとPostgreSQLの型がinfrastructure内に収まる。
- row-to-module mapperが明示される。
- 一意constraintとtransactionが同時実行時にも同じ機能結果を成立させる。
- expected resultとunexpected failureの境界がtestで確認される。
- schema、migration、repository integration test、型検査、lintが成功する。
