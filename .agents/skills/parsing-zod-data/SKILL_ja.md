---
name: parsing-zod-data
description: Zod 4 データを parse、safeParse、非同期バリアント、z.infer、z.input、z.output でパースおよび型推論する。既存のスキーマに対するランタイム値の検証時や、スキーマからの TypeScript 型抽出時に使用する。スキーマ形状の定義のみ、refine / transform / codec のみ、エラーメッセージカスタマイズのみ、JSON Schema 変換のみ、Hono バリデーターのみ、OpenAPI ルート配線のみには使用しない。
---

# Zod データのパース

parse または型推論の呼び出し箇所を変更する前に、最新の公式 Zod 4 基本使用法ドキュメントを読むこと。クラシック `zod` パッケージ API のみを使用する。

## 必要なドキュメントレビュー

1. <https://zod.dev/basics> を開き、parse または推論の変更箇所を特定する。
2. 実装前に対応するセクションを読む：
   - データのパース：<https://zod.dev/basics?id=parsing-data>
   - スローされる `ZodError` と結果オブジェクトの処理：<https://zod.dev/basics?id=handling-errors>
   - 型の推論：<https://zod.dev/basics?id=inferring-types>
3. 変更に失敗メッセージやフォーマット済みイシューが含まれる場合は、`$handling-zod-errors` も使用する。
4. 読んだドキュメントの URL とパースの判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- `import { z } from 'zod'` でインポートする（Zod 4 クラシック API）。
- 無効な入力が起動や信頼境界（例：環境変数設定ローダー）を停止しなければならない場合は `.parse()` を使用する。
- 呼び出し元が失敗をアプリケーションエラーレスポンスや分岐ロジックにマッピングする場合は `.safeParse()` を使用する。
- スキーマに非同期リファインメントやトランスフォームが含まれる場合は `.parseAsync()` / `.safeParseAsync()` を使用する。
- 出力型には `z.infer<typeof schema>` を優先する。トランスフォームにより入力と出力が異なる場合は `z.input` / `z.output` を使用する。
- HTTP リクエストバリデーションは `$validating-hono-requests` に残す。ここで Hono バリデーターを再実装しない。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだ parse または推論機能と公式 Zod ドキュメント |
| 設計 | Parse API の選択、失敗パス、推論される TypeScript 型 |
| 実装 | レビュー済みドキュメントに従った parse または型抽出の変更 |
| 検証 | 型チェックと、変更された呼び出し箇所に対する有効/無効入力のアサーション |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| 無効入力でスロー | Parsing data | `.parse()` 呼び出し箇所とスローされる `ZodError` の所有権 |
| 成功/失敗で分岐 | Handling errors | `.safeParse()` 結果の処理 |
| 非同期スキーマ | Parsing data async notes | `.parseAsync()` または `.safeParseAsync()` |
| 共有 TypeScript 型 | Inferring types | `z.infer`、`z.input`、または `z.output` |
| 環境変数または設定の読み込み | Basics とプロジェクト設定パターン | スキーマ所有者とフェイルファスト動作 |

## 完了チェック

パースの変更が完了したと報告する前に、レビューしたドキュメント、変更した parse または推論箇所、検証結果を提供すること。
