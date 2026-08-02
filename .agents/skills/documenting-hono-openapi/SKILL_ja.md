---
name: documenting-hono-openapi
description: Hono OpenAPI コントラクトを @hono/zod-openapi、OpenAPIHono、ルートスキーマ、/openapi.json、BearerAuth セキュリティスキームで定義・変更する。OpenAPI ドキュメントまたは文書化されたルートスキーマの編集時に使用する。Node.js ブートストラップ、ミドルウェアのみの変更、文書化されていないバリデーターのみ、テストのみには使用しない。
---

# Hono OpenAPI の文書化

OpenAPI スキーマまたはドキュメントエンドポイントを変更する前に、最新の公式 Hono OpenAPI の例を読むこと。ランタイムは Node.js のみ。OpenAPI は Hono の例とサードパーティパッケージにあり、コア API ドキュメントのみではない。

## 必要なドキュメントレビュー

1. `@hono/zod-openapi` の使用法を変更する前に <https://hono.dev/examples/zod-openapi> を開く。
2. <https://hono.dev/docs/middleware/third-party> の OpenAPI セクションを読む。
3. API リファレンス UI を追加する場合のみ <https://hono.dev/examples/swagger-ui> または <https://hono.dev/examples/scalar> を読む。
4. 読んだドキュメントの URL と OpenAPI の判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- API コントラクトソースとして `@hono/zod-openapi` / `OpenAPIHono` を使用する。
- `GET /openapi.json` でドキュメントを提供する。
- OpenAPI スキーマはリクエストバリデーション、レスポンスバリデーション、モバイル型付きクライアント生成を駆動する。
- 共有 Zod コンポーネントスキーマは `$defining-zod-schemas` で定義する。`$converting-zod-json-schema` はこの OpenAPI パイプライン外のスタンドアロン JSON Schema 変換にのみ使用する。
- `components.securitySchemes.BearerAuth` を HTTP bearer JWT として定義する。保護ルートは `security: [{ BearerAuth: [] }]` を使用する。`/health` と `/openapi.json` は公開のままとする。
- 共有エラーレスポンスは `code`、`message`、`requestId`、`retryable` を持つ文書化されたエラースキーマを使用する。
- 入力スキーマの変更は `$validating-hono-requests` の動作と組み合わせ、`$testing-hono-apis` で検証する。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだ OpenAPI 機能と公式 Hono の例 |
| 設計 | パス、スキーマ、ステータス、セキュリティ要件、ドキュメントエンドポイント |
| 実装 | レビュー済みドキュメントに従った OpenAPIHono とスキーマの変更 |
| 検証 | 型チェックと、`/openapi.json` が変更されたコントラクトを記述していることのアサーション |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| 新しい文書化ルート | Zod OpenAPI example | パス、メソッド、リクエスト/レスポンススキーマ、セキュリティ |
| 共有コンポーネントスキーマ | Zod OpenAPI example | スキーマ名とフィールド。必要に応じて `$defining-zod-schemas` で形状を定義 |
| OpenAPI ドキュメントエンドポイント | Zod OpenAPI example | パスと OpenAPI バージョン |
| Bearer セキュリティスキーム | プロジェクト API 設計と Zod OpenAPI example | スキーム ID と保護ルート |
| API リファレンス UI | Swagger UI または Scalar example | UI パスとドキュメント URL |
| スタンドアロン JSON Schema エクスポート | `$converting-zod-json-schema` | `/openapi.json` 外の変換ターゲット |

## 完了チェック

OpenAPI の変更が完了したと報告する前に、レビューしたドキュメント、変更したスキーマまたはドキュメントエンドポイント、検証結果を提供すること。
