---
name: composing-hono-middleware
description: Hono ミドルウェアを app.use の順序、カスタムミドルウェア、request-id / body-limit / cors / secure-headers / logger / bearer-auth などの組み込みミドルウェアで構成する。ミドルウェアスタックや横断的なリクエスト処理の変更時に使用する。ルートハンドラーのみ、Node.js ブートストラップ、OpenAPI スキーマ定義、バリデーションスキーマ、テストのみには使用しない。
---

# Hono ミドルウェアの構成

ミドルウェアスタックを変更する前に、最新の公式 Hono ミドルウェアドキュメントを読むこと。ランタイムは Node.js のみ。

## 必要なドキュメントレビュー

1. <https://hono.dev/docs/guides/middleware> を開き、ミドルウェアの変更箇所を特定する。
2. 実装前に対応するドキュメントを読む：
   - ミドルウェアの概念：<https://hono.dev/docs/concepts/middleware>
   - 変更対象の組み込みページ：<https://hono.dev/docs/middleware/builtin/>
   - 必要な場合のサードパーティミドルウェア：<https://hono.dev/docs/middleware/third-party>
3. 読んだドキュメントの URL とミドルウェアの判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- 登録順が実行順を決定する。共有ミドルウェアはルートハンドラーの前に配置する。
- API にリクエスト ID、セキュアヘッダー、構造化ログを提供する。
- JSON ボディ制限は 1 MiB（1,048,576 バイト）とする。超過リクエストは HTTP 413 を返し、`code: "PAYLOAD_TOO_LARGE"`、`message: "Request body exceeds the allowed size."`、`requestId`、`retryable: false` を含む。
- 認証済み `/v1` ルートはハンドラーの前に Cognito アクセストークンを検証する。`/health` と `/openapi.json` は公開のままとする。
- 保護ルートへの未認証アクセスは HTTP 401 を返し、`code: "UNAUTHENTICATED"`、`message: "Authentication is required."`、`requestId`、`retryable: false` を含む。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだミドルウェア機能と公式 Hono ドキュメント |
| 設計 | ミドルウェアの順序、パススコープ、ヘッダー、失敗レスポンス |
| 実装 | レビュー済みドキュメントに従ったミドルウェアの変更 |
| 検証 | 型チェックと `$testing-hono-apis` によるリクエストアサーション |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| ミドルウェアの追加または並び替え | Guides middleware と concept | 順序、パススコープ、早期終了動作 |
| リクエスト ID | Built-in request-id | ヘッダー名とレスポンスエコー |
| ボディサイズ制限 | Built-in body-limit | 制限バイト数と 413 エラーコントラクト |
| CORS またはセキュアヘッダー | 該当する組み込みドキュメント | 許可オリジン/ヘッダーとセキュリティヘッダー |
| `/v1` の認証ゲート | プロジェクト API 設計と bearer-auth またはカスタムミドルウェアドキュメント | 公開パスと保護パス、401 コントラクト |

## 完了チェック

ミドルウェアの変更が完了したと報告する前に、レビューしたドキュメント、変更したミドルウェアスタック、検証結果を提供すること。
