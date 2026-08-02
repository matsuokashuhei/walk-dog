---
name: routing-hono-apis
description: Hono ルート、app.route 構成、Context と HonoRequest の使用法、HTTPException 処理を定義・変更する。HTTP ハンドラーとパス構造の追加・編集時に使用する。Node.js ブートストラップ、ミドルウェアのみの変更、バリデーションスキーマ、OpenAPI ドキュメント配線、テストのみには使用しない。
---

# Hono API のルーティング

ルートハンドラーまたはパス構成を変更する前に、最新の公式 Hono ルーティングおよび API ドキュメントを読むこと。ランタイムは Node.js のみ。

## 必要なドキュメントレビュー

1. <https://hono.dev/docs/api/hono> を開き、ルーティングの変更箇所を特定する。
2. 実装前に対応するドキュメントを読む：
   - ルーティング：<https://hono.dev/docs/api/routing>
   - Context：<https://hono.dev/docs/api/context>
   - HonoRequest：<https://hono.dev/docs/api/request>
   - HTTPException：<https://hono.dev/docs/api/exception>
   - 大規模アプリとハンドラー配置：<https://hono.dev/docs/guides/best-practices>
3. 読んだドキュメントの URL とルーティングの判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- リソースルートモジュールを `app.route` で `/v1` 配下に登録する。
- パスパラメーターが型付けされたままになるよう、パスとともに宣言するハンドラーを優先する。Ruby-on-Rails 的なコントローラーは避ける。
- 文書化された成功 JSON または共有エラー JSON（`code`、`message`、`requestId`、`retryable`）を返す。
- OpenAPI は公開コントラクトの所有者として維持する（`$documenting-hono-openapi`）。入力チェックは必要に応じて `$validating-hono-requests` を使用する。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだルーティング機能と公式 Hono ドキュメント |
| 設計 | メソッド、パス、ステータス、成功とエラーのレスポンス、`/v1` 配下のモジュール配置 |
| 実装 | レビュー済みドキュメントに従ったルートモジュールの変更 |
| 検証 | 型チェックと `$testing-hono-apis` によるリクエストアサーション |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| 新しいリソースルート | Routing、Context、best practices | メソッド、パス、モジュールファイル、ステータス |
| パスまたはクエリパラメーター | Routing と HonoRequest | パラメーター名と型付きアクセス |
| ルートモジュールの分割 | Best practices `app.route` | マウントパスとエクスポートされた app |
| 致命的なハンドラーエラー | HTTPException | ステータス、メッセージ、処理箇所 |
| レスポンス形状の変更 | プロジェクト API コントラクトと OpenAPI スキル | DTO フィールドとエラーフィールド |

## 完了チェック

ルーティングの変更が完了したと報告する前に、レビューしたドキュメント、変更したルート、検証結果を提供すること。
