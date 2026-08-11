---
name: integrating-api-adapters
description: Node.js APIでCognito、S3、SQS、DynamoDBなどの外部service adapterをmodule provider interfaceへ実装または変更するときに使用する。SDK command、input/output変換、既知error mapping、config/client注入、client lifecycle、adapter testを扱う。
---

# API adapter の実装

外部SDKの表現をinfrastructureへ閉じ込め、moduleが要求する能力と結果へ変換する。

## 配置

- provider interfaceとmodule result: `src/modules/<feature>/provider.ts`
- adapter: `src/infrastructure/<provider>/<capability>.ts`
- client factory: `src/infrastructure/<provider>/client.ts`
- provider config parsing: `src/infrastructure/config/`またはproviderのconfig module
- adapter test: `test/infrastructure/<provider>/<capability>.test.ts`
- client生成と注入: `src/index.ts`

module interfaceはSDK command、SDK response、SDK exception、HTTP statusを公開しない。

## Provider interfaceを先に定義する

method名、input、success、期待可能な結果を機能の言葉で定義する。SDK operation名をそのままinterfaceへ使うのは、機能の意味と一致するときに限る。

```ts
type SignInProviderResult =
  | { outcome: 'authenticated'; tokens: AuthenticationTokens }
  | { outcome: 'invalid-code' }
  | { outcome: 'code-expired' }
  | { outcome: 'rate-limited' }
```

HTTP code、message、request ID、retryableはrouteが割り当てる。

## SDK commandへ変換する

adapterはmodule inputからSDK command inputを一箇所で構築する。

- 外部field名、enum、header、object key、message attributeをadapterで設定する。
- 必要なconfig値をconstructorまたはfactory引数で受け取る。
- adapter内で環境変数を読む処理とclient生成を行わない。
- command inputをtestで完全一致または意味のあるfield単位で検証する。

## SDK outputをmodule結果へ変換する

- SDKのPascalCase、nullable、metadata、binary表現をmodule型へ変換する。
- successに必要なfieldが揃うことをadapterで確認する。
- SDK responseまたはJWT payloadをuse caseへ渡さない。
- moduleが別parser能力を要求する設計では、parserを別adapterとして実装する。

upstream success responseが必要なfieldを満たさない状態はinfrastructure failureとして扱う。

## Error境界

公式SDKのexception classまたはdocumented discriminatorで既知の結果をmodule outcomeへ変換する。error name文字列だけを広く比較しない。

- 入力誤り、認証challenge失敗、rate limitなど機能が処理する状態だけをmappingする。
- connection、credential、timeout、未知exception、programming errorは同じerrorとして伝播させる。
- adapterはHTTP error envelopeへ変換しない。
- broad catchで未知errorを既知結果へ収束させない。

## Client lifecycle

composition rootが設定を読み、一つの長寿命clientを生成し、adapterへ注入する。requestごとにSDK clientを生成しない。adapterは注入されたclientをdestroyしない。server shutdownを所有するcompositionがclientを一度閉じる。

clientを共有できる範囲はcredential、region、endpoint、lifecycleが同じadapter群とする。

## Test-first workflow

1. module provider interfaceと期待可能outcomeをtestで確定する。
2. 公式provider/SDK資料でcommand、response、exception、retry semanticsを確認する。
3. fake clientまたは送信関数を注入し、command testを先に書く。
4. success output変換と必要field不足をtestする。
5. 各既知exception classのmappingをtable testする。
6. sentinel errorが同一のerrorとして伝播することをtestする。
7. composition testでclientの一回生成、adapter注入、shutdownを確認する。

## 完了条件

- adapterがmodule provider interfaceを実装する。
- SDK型とexceptionがinfrastructure内に収まる。
- command inputとsuccess outputの変換がtestされる。
- 既知exceptionだけがmodule outcomeへ変換される。
- 未知errorが保持され、共通application error処理へ到達する。
- clientとconfigがcomposition rootから注入され、lifecycleが一箇所で管理される。
