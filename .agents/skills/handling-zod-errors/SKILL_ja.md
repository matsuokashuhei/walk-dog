---
name: handling-zod-errors
description: Zod 4 バリデーションエラーをカスタマイズ・フォーマットする。スキーマレベルの error パラメーター、parse ごとのマップ、ロケール、treeifyError、flattenError、prettifyError を含む。ZodError メッセージの変更や、表示・API マッピングのためのイシュー変換時に使用する。スキーマ形状の定義のみ、parse 呼び出し箇所の選択のみ、refine / transform ロジックのみ、JSON Schema 変換のみ、Hono バリデーターのみ、OpenAPI ルート配線のみには使用しない。
---

# Zod エラーの処理

エラーメッセージやイシュー形状を変更する前に、最新の公式 Zod 4 エラーカスタマイズ・フォーマットドキュメントを読むこと。クラシック `zod` パッケージ API のみを使用する。

## 必要なドキュメントレビュー

1. <https://zod.dev/error-customization> を開き、エラーハンドリングの変更箇所を特定する。
2. 実装前に対応するドキュメントを読む：
   - スキーマと parse ごとの `error` パラメーター：<https://zod.dev/error-customization?id=the-error-param>、<https://zod.dev/error-customization?id=per-parse-error-customization>
   - グローバル設定とロケール：<https://zod.dev/error-customization?id=global-error-customization>、<https://zod.dev/error-customization?id=internationalization>
   - 優先順位ルール：<https://zod.dev/error-customization?id=error-precedence>
   - フォーマットヘルパー：<https://zod.dev/error-formatting>
3. 読んだドキュメントの URL とエラーハンドリングの判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- `import { z } from 'zod'` でインポートする（Zod 4 クラシック API）。
- 非推奨の `message`、`invalid_type_error`、`required_error`、`errorMap` よりも Zod 4 の `error` パラメーター / エラーマップを優先する。
- `ZodError` の非推奨インスタンスヘルパー（`.format()` / `.flatten()`）よりも `z.treeifyError()`、`z.flattenError()`、`z.prettifyError()` を優先する。
- フィールド固有のコントラクトにはスキーマレベルのメッセージを維持する。parse ごとのマップは、1 つの呼び出し箇所だけが異なる文言を必要とする場合にのみ使用する。
- イシューペイロードに生の入力を意図的に含める場合を除き、`reportInput: true` を避ける。
- HTTP 境界での Zod 失敗は `$validating-hono-requests` を通じて共有 API エラー JSON にマッピングする。ここで第二の公開エラー形状を考案しない。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだエラー機能と公式 Zod ドキュメント |
| 設計 | メッセージの所有権（スキーマ / parse / グローバル）、ロケール、出力フォーマット |
| 実装 | レビュー済みドキュメントに従ったエラーパラメーターまたはフォーマットの変更 |
| 検証 | 型チェックと、無効な入力が期待されるメッセージまたはフォーマットされた構造を生成することのアサーション |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| フィールドレベルのカスタムメッセージ | The error param | スキーマ箇所とメッセージテキスト |
| 呼び出し箇所のみの文言 | Per-parse error customization | Parse オプションと優先順位 |
| ロケールまたはグローバルマップ | Internationalization と global customization | ロケールまたは `z.config` の選択 |
| UI 用のネストされたイシューツリー | `z.treeifyError()` | ターゲットパスとコンシューマー |
| フラットなフィールドエラー | `z.flattenError()` | `formErrors` / `fieldErrors` マッピング |
| 人間可読なログ文字列 | `z.prettifyError()` | ログまたは表示の出力先 |

## 完了チェック

エラーハンドリングの変更が完了したと報告する前に、レビューしたドキュメント、変更したメッセージまたはフォーマッター、検証結果を提供すること。
