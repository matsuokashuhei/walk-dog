---
name: migrating-drizzle-postgres
description: Drizzle Kit を使用した PostgreSQL SQL マイグレーションの生成、レビュー、適用。drizzle-kit generate または migrate の実行時、マイグレーション SQL のレビュー時、drizzle.config の設定時に使用する。アドホックなスキーマ編集（マイグレーションなし）、SQL CRUD、リレーショナルクエリ、Pool セットアップのみには使用しない。
---

# Drizzle Postgres のマイグレーション

マイグレーションを生成または適用する前に、最新の公式 Drizzle Kit マイグレーションドキュメントを読むこと。ダイアレクトは PostgreSQL のみ。プロジェクトのマイグレーション順序に正確に従う。

## 必要なドキュメントレビュー

1. <https://orm.drizzle.team/docs/migrations> を開き、マイグレーションワークフローを特定する。
2. 実装前に対応するドキュメントを読む：
   - Kit 概要：<https://orm.drizzle.team/docs/kit-overview>
   - SQL 生成：<https://orm.drizzle.team/docs/drizzle-kit-generate>
   - SQL 適用：<https://orm.drizzle.team/docs/drizzle-kit-migrate>
   - 設定ファイル：<https://orm.drizzle.team/docs/drizzle-config-file>
3. 読んだドキュメントの URL とマイグレーションの判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- 真実の源泉は TypeScript Drizzle スキーマである。
- 本番および共有開発フローはコードベースファースト：`generate` → SQL レビュー → `migrate`。
- プロジェクトのマイグレーションフローには `drizzle-kit push` を使用しない。
- ランタイム `npm run migrate` は専用の PostgreSQL セッションを使用し、アドバイザリロック `walk_dog_schema_migration` を取得し、Drizzle マイグレーションを適用し、適用バージョンをログに記録し、セッション終了時にロックを解放する。
- スキーマ定義の編集は生成前に `$drizzle:defining-drizzle-schemas` に属する。

## 必要な順序

データベース形状変更にはこの順序を実行する。レビューをスキップしない。

1. TypeScript スキーマを更新する（`$drizzle:defining-drizzle-schemas`）。
2. プロジェクトの `drizzle.config` で `drizzle-kit generate` を実行する。
3. 生成された SQL マイグレーションを意図した形状変更についてレビューする。
4. プロジェクトのマイグレーションコマンド（`npm run migrate` または文書化された Kit マイグレーションエントリーポイント）で適用する。
5. 適用されたマイグレーションバージョンと依存するチェックを検証する。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだ Kit コマンドと公式 Drizzle ドキュメント |
| 設計 | スキーマ差分の意図、マイグレーションフォルダー、適用環境 |
| 実装 | 生成された SQL と、必要な場合のみの設定またはマイグレーションスクリプトの変更 |
| 検証 | レビュー済み SQL、成功したマイグレーション、新しい形状に依存する型チェックまたはテスト |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| スキーマ形状の変更 | Migrations fundamentals と generate | 生成されたマイグレーションパスと SQL 概要 |
| 保留中マイグレーションの適用 | Migrate docs とプロジェクトマイグレーションコマンド | 適用されたバージョンとロック動作 |
| drizzle.config の変更 | Config file docs | dialect、schema path、out path |
| generate 時のリネームの曖昧さ | Generate docs | セッションログに記録されたリネーム回答 |
| push による SQL ファイルのバイパス | プロジェクトフローでは使用しない | N/A |

## 完了チェック

マイグレーションの変更が完了したと報告する前に、レビューしたドキュメント、生成または適用されたマイグレーション成果物、SQL レビュー結果、検証結果を提供すること。
