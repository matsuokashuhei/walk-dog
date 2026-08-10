---
name: defining-zod-schemas
description: Zod 4 スキーマを定義・変更する。プリミティブ、オブジェクト、配列、ユニオン、enum、構成ヘルパー、メタデータを含む。z.object、z.string、z.enum、pick / omit / extend、.meta / .describe の編集時に使用する。parse / safeParse のみ、refine / transform / codec のみ、エラーフォーマットのみ、JSON Schema 変換のみ、Hono リクエストバリデーターのみ、OpenAPI ルート配線のみには使用しない。
---

# Zod スキーマの定義

スキーマ定義を変更する前に、最新の公式 Zod 4 スキーマドキュメントを読むこと。クラシック `zod` パッケージ API のみを使用する。

## 必要なドキュメントレビュー

1. <https://zod.dev/api> を開き、スキーマの変更箇所を特定する。
2. 実装前に対応するドキュメントを読む：
   - プリミティブ、文字列、数値、日付、フォーマット：<https://zod.dev/api?id=primitives>、<https://zod.dev/api?id=strings>、<https://zod.dev/api?id=string-formats>、<https://zod.dev/api?id=numbers>
   - オブジェクトと構成：<https://zod.dev/api?id=objects>、<https://zod.dev/api?id=extend>、<https://zod.dev/api?id=pick>、<https://zod.dev/api?id=omit>、<https://zod.dev/api?id=partial>
   - 配列、タプル、ユニオン、レコード、enum：<https://zod.dev/api?id=arrays>、<https://zod.dev/api?id=unions>、<https://zod.dev/api?id=discriminated-unions>、<https://zod.dev/api?id=records>、<https://zod.dev/api?id=enums>
   - Optionals と nullables：<https://zod.dev/api?id=optionals>、<https://zod.dev/api?id=nullables>、<https://zod.dev/api?id=nullish>
   - スキーマ文書化時のメタデータ：<https://zod.dev/metadata>
3. 読んだドキュメントの URL とスキーマの判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- `import { z } from 'zod'` でインポートする（Zod 4 クラシック API）。
- `tsconfig` の `strict` を有効にする。Zod はこれに依存する。
- 非推奨のチェーン型文字列ヘルパーよりも、`z.url()`、`z.email()`、`z.uuid()` などのトップレベル Zod 4 文字列フォーマットを優先する。
- 非推奨の `z.nativeEnum()` よりも `z.enum()` を優先する。
- プレーンオブジェクトの非推奨 `.strict()` / `.passthrough()` よりも `z.strictObject()` / `z.looseObject()` を優先する。
- スキーマが OpenAPI または JSON Schema に供給される場合は、`.meta()` または `.describe()` で文書メタデータを付与する。
- HTTP リクエストの配線は `$hono:validating-hono-requests`、公開ルートコントラクトは `$hono:documenting-hono-openapi` に任せる。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだスキーマ機能と公式 Zod ドキュメント |
| 設計 | フィールド、null 許容性、ユニオン、構成、メタデータ |
| 実装 | レビュー済みドキュメントに従ったスキーマファイルの変更 |
| 検証 | 型チェックと、スキーマが他でパースされる場合は `$zod:parsing-zod-data` によるアサーション |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| 新しいオブジェクトまたはフィールド | Objects と primitives | フィールド名、型、省略可能性 |
| 文字列フォーマット制約 | Strings と string formats | フォーマットヘルパーと許可値 |
| Enum またはリテラル集合 | Enums と literals | 許可値と TypeScript での使用法 |
| Pick、omit、extend、partial | Object composition sections | ベーススキーマと派生形状 |
| 判別ユニオン | Discriminated unions | 判別キーとバリアント |
| スキーマ文書メタデータ | Metadata と registries | id、title、description、examples |

## 完了チェック

スキーマ定義の変更が完了したと報告する前に、レビューしたドキュメント、変更したスキーマ、検証結果を提供すること。
