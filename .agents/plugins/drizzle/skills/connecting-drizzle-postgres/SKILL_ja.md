---
name: connecting-drizzle-postgres
description: Drizzle PostgreSQL クライアントを node-postgres Pool、接続設定、シャットダウンとともに作成・構成する。DATABASE_URL、pg.Pool、drizzle()、接続ライフサイクルの配線時に使用する。テーブルスキーマ定義、SQL CRUD、リレーショナルクエリ、マイグレーション生成のみには使用しない。
---

# Drizzle Postgres の接続

データベースクライアントのセットアップを変更する前に、最新の公式 Drizzle PostgreSQL 接続ドキュメントを読むこと。ダイアレクトは PostgreSQL のみ。

## 必要なドキュメントレビュー

1. 接続コードを変更する前に <https://orm.drizzle.team/docs/connect-overview> を開く。
2. 実装前に対応するドキュメントを読む：
   - PostgreSQL ドライバー接続：<https://orm.drizzle.team/docs/get-started-postgresql>
   - ブートストラップ時の接続パターン：<https://orm.drizzle.team/docs/get-started/postgresql-new> または <https://orm.drizzle.team/docs/get-started/postgresql-existing>
3. 読んだドキュメントの URL と接続の判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- プロセス（API またはワーカー）ごとに 1 つの `pg.Pool` を作成し、Drizzle に渡す。
- 接続 URL と `DATABASE_POOL_MAX`（デフォルト 10）には検証済み環境変数を使用する。
- シャットダウン時に Pool をクローズし、接続を PostgreSQL に返す。
- リレーショナルクエリで `db.query` が必要な場合は、スキーマモジュールを `drizzle()` に渡す。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだドライバー、接続機能、公式 Drizzle ドキュメント |
| 設計 | Pool の所有権、環境変数キー、`db.query` 用スキーマインポート、シャットダウン順序 |
| 実装 | レビュー済みドキュメントに従ったクライアントファクトリーとライフサイクルの変更 |
| 検証 | 型チェックと、可能な場合は接続を利用した health または smock チェック |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| 初めての Drizzle クライアント | Connect overview と PostgreSQL get-started | ドライバーパッケージ、Pool 作成箇所、drizzle() 呼び出し |
| Pool サイズ設定 | Connect docs とプロジェクト環境変数コントラクト | `DATABASE_POOL_MAX` とプロセス所有権 |
| スキーマ認識クライアント | Connect docs とリレーションクエリドキュメント | drizzle() に渡すスキーマモジュール |
| シャットダウン / ドレイン | プロセスライフサイクル | HTTP またはワーカー停止に対する Pool クローズの順序 |

## 完了チェック

接続の変更が完了したと報告する前に、レビューしたドキュメント、変更したクライアントライフサイクル、検証結果を提供すること。
