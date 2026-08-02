---
name: converting-zod-json-schema
description: Zod 4 スキーマと JSON Schema の間を toJSONSchema と fromJSONSchema で変換する。target、io、metadata、cycles、unrepresentable オプションを含む。Zod から JSON Schema を生成する、または JSON Schema から Zod を構築する際に使用する。スキーマ形状の定義のみ、parse/safeParse のみ、refine/transform のみ、エラーフォーマットのみ、Hono バリデーターのみ、@hono/zod-openapi ルートドキュメントの配線のみには使用しない。
---

# Zod JSON Schema の変換

Zod ↔ JSON Schema の変換を変更する前に、最新の公式 Zod 4 JSON Schema ドキュメントを読むこと。クラシック `zod` パッケージ API のみを使用する。

## 必要なドキュメントレビュー

1. <https://zod.dev/json-schema> を開き、変換の変更箇所を特定する。
2. 実装前に対応するドキュメントを読む：
   - `z.toJSONSchema()` とパラメーター：<https://zod.dev/json-schema?id=ztojsonschema>
   - JSON Schema を取り込む場合の `z.fromJSONSchema()`：<https://zod.dev/json-schema?id=zfromjsonschema>
   - 変換時に使用されるメタデータ：<https://zod.dev/metadata>
3. 結果が公開 Hono OpenAPI ドキュメントの場合は、`$documenting-hono-openapi` も使用し、`@hono/zod-openapi` を置き換えない。
4. 読んだドキュメントの URL と変換の判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- `import { z } from 'zod'` でインポートする（Zod 4 クラシック API）。
- 提供される `/openapi.json` コントラクトには `@hono/zod-openapi` / `OpenAPIHono` を優先する。そのパイプライン外のスタンドアロン JSON Schema 要件には `z.toJSONSchema()` を使用する。
- `z.fromJSONSchema()` は実験的として扱い、採用時にそのリスクを記録する。
- コンシューマーが Draft 7、Draft 2020-12、または `openapi-3.0` を必要とする場合は `target` を明示的に設定する。
- JSON Schema が parse 入力（変換後出力ではなく）を記述する必要がある場合は `{ io: "input" }` を使用する。
- 変換前に表現不可能な型（`z.date()`、transform、map など）を解決するか、`unrepresentable` を意図的に設定する。
- 変換されたスキーマにドキュメントフィールドを持たせるために `.meta({ id, title, description })` を優先する。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだ変換の方向と公式 Zod ドキュメント |
| 設計 | ターゲットダイアレクト、io モード、メタデータ登録、表現不可能な型の処理 |
| 実装 | レビュー済みドキュメントに従った変換呼び出し箇所の変更 |
| 検証 | 型チェックと、出力または取り込んだ JSON Schema 形状に対するアサーション |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| Zod から JSON Schema | `z.toJSONSchema()` | Target、io、出力先 |
| JSON Schema から Zod | `z.fromJSONSchema()` | 実験的ステータスとソーススキーマ |
| OpenAPI 3.0 ダイアレクト | target オプション | `openapi-3.0` と Draft ターゲットの比較 |
| 入力 vs 出力スキーマ | io オプション | コンシューマーが検証する側 |
| 循環または再利用定義 | cycles と reused パラメーター | `$ref` 戦略 |
| 出力のメタデータ | Metadata と registries | id、title、description |

## 完了チェック

JSON Schema 変換の変更が完了したと報告する前に、レビューしたドキュメント、変更した変換箇所、検証結果を提供すること。
