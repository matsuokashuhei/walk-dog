---
name: bootstrapping-hono-nodejs
description: 新しい Hono Node.js API パッケージの初期化または再構成。create-hono、Node アダプター、serve エントリーポイント、アプリケーションファクトリーの分離、パッケージスクリプトを含む。apps/api の初期化や Node.js ランタイム起動の変更時に使用する。ルートハンドラー、ミドルウェア構成、バリデーション、OpenAPI スキーマ、テストのみには使用しない。
---

# Hono Node.js のブートストラップ

パッケージのブートストラップやランタイム起動を変更する前に、最新の公式 Hono Node.js ドキュメントを読むこと。ランタイムは Node.js のみ。

## 必要なドキュメントレビュー

1. Node アダプターやサーバー起動を変更する前に <https://hono.dev/docs/getting-started/nodejs> を開く。
2. `create-hono` を使用または調整する際に <https://hono.dev/docs/guides/create-hono> を読む。
3. 読んだドキュメントの URL とブートストラップの判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- API パッケージは `apps/api` に配置する。
- `src/app.ts` はアプリケーションファクトリーとして維持する。`src/index.ts` は `@hono/node-server` でファクトリーの結果を提供する Node.js エントリーポイントとして維持する。
- テストは Node.js リスナーを起動せずにファクトリーをインポートする（`$testing-hono-apis`）。
- パッケージスクリプト：
  - `dev`：`tsx watch src/index.ts`
  - `build`：本番出力を `dist` に書き出す TypeScript コンパイル
  - `start`：`node dist/index.js`

## Node.js の初期化

公式ドキュメントのレビュー後、以下の順序で最初の Node.js API を初期化する：

1. `cd apps/api` を実行する。
2. `npm create hono@latest .` を実行する。
3. Node.js テンプレートと npm での依存関係インストールを選択する。
4. 上記のパッケージスクリプトを定義する。
5. ファクトリー / エントリーポイントの分離を維持する。
6. API を拡張する前に最初のパブリックコントラクトを定義する：`GET /health`、`GET /openapi.json`、各レスポンスのリクエスト ID、status / message / requestId / retryable を含む JSON エラーレスポンス。
7. health、OpenAPI、リクエスト ID、エラーレスポンスのコントラクトテストを追加する（`$testing-hono-apis`）。
8. `$documenting-hono-openapi` で OpenAPI を、`$composing-hono-middleware` で共有ミドルウェアを配線する。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだ Node.js アダプターと create-hono のドキュメント |
| 設計 | パッケージの場所、スクリプト、ファクトリー/エントリーポイントの境界、最初のパブリックコントラクト |
| 実装 | レビュー済みドキュメントに従ったブートストラップと起動の変更 |
| 検証 | 型チェック、パッケージスクリプト、`$testing-hono-apis` によるコントラクトテスト |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| 新しい Node.js API | Node.js getting-started と create-hono | テンプレート、スクリプト、ファクトリー/エントリーポイントのパス |
| dev または start コマンド | Node.js getting-started | スクリプトコマンドとエントリーファイル |
| リスナー vs テスト可能なアプリ | Node.js getting-started | ファクトリーのエクスポートと serve の呼び出し箇所 |
| 最初の公開エンドポイント | プロジェクト API 設計 | `/health`、`/openapi.json`、リクエスト ID、エラー JSON |

## 完了チェック

ブートストラップの変更が完了したと報告する前に、レビューしたドキュメント、変更したパッケージとエントリーポイントの境界、検証結果を提供すること。
