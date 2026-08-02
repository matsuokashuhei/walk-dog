---
name: validating-hono-requests
description: Hono リクエスト入力を hono/validator、Zod、@hono/zod-validator で検証する。バリデーターエラーハンドリングを含む。json、query、param、header、cookie、form のリクエストバリデーション変更時に使用する。OpenAPI ドキュメント生成のみ、ルート構造のみ、ミドルウェアスタックのみ、Node.js ブートストラップ、テストのみには使用しない。
---

# Hono リクエストのバリデーション

リクエストバリデーターを変更する前に、最新の公式 Hono バリデーションドキュメントを読むこと。ランタイムは Node.js のみ。

## 必要なドキュメントレビュー

1. <https://hono.dev/docs/guides/validation> を開き、バリデーションターゲットを特定する。
2. バリデーターエラーレスポンスを整形する場合に <https://hono.dev/examples/validator-error-handling> を読む。
3. バリデーションフィールドが公開 API コントラクトの一部である場合、`$documenting-hono-openapi` も使用する。
4. 読んだドキュメントの URL とバリデーションの判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- OpenAPI / Zod スキーマが公開エンドポイントのリクエストバリデーションのソースである。
- エンドポイントが文書化されている場合は `@hono/zod-openapi` ルート定義を優先する。`@hono/zod-validator` または `hono/validator` は、そのパスが意図的な場合のみ使用する。
- Zod スキーマの形状は `$defining-zod-schemas` で定義し、リファインメントやトランスフォームは `$transforming-zod-schemas` で行い、スキーマ自体が変更される場合は Zod イシューの文言マッピングを `$handling-zod-errors` で行う。
- バリデーション失敗は、HTTP ステータス、`code`、`message`、`requestId`、`retryable` を含む共有エラー JSON を返す。
- JSON およびフォームバリデーターは、対応する `Content-Type` ヘッダーを必要とする。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだバリデーションターゲットと公式 Hono ドキュメント |
| 設計 | ターゲット（`json` / `query` / `param` / 等）、スキーマ、失敗レスポンス |
| 実装 | レビュー済みドキュメントに従ったバリデーターの変更 |
| 検証 | 型チェックと `$testing-hono-apis` による無効/有効リクエストアサーション |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| JSON ボディバリデーション | Validation guide | スキーマフィールドと Content-Type 要件 |
| クエリまたはパスバリデーション | Validation guide | ターゲットキーとスキーマ |
| Zod バリデーター ミドルウェア | Validation guide Zod sections | パッケージ選択とスキーマ再利用 |
| Zod スキーマフィールドまたはリファイン変更 | Zod defining / transforming skills | スキーマ所有者と Hono ターゲット |
| カスタムバリデーションエラーボディ | Validator error-handling example | ステータス、code、message、retryable |
| 文書化された公開入力 | OpenAPI skill | OpenAPI ドキュメント内のスキーマ所有者 |

## 完了チェック

バリデーションの変更が完了したと報告する前に、レビューしたドキュメント、変更したバリデーター、検証結果を提供すること。
