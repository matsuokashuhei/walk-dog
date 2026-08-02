---
name: defining-drizzle-schemas
description: Drizzle PostgreSQL スキーマを定義・変更する。テーブル、カラム、インデックス、制約、enum、スキーマレベルのリレーションを含む。pgTable 定義、カラム型、インデックス、外部キーの編集時に使用する。SQL ライクな CRUD、db.query リレーショナルフェッチ、Pool セットアップ、drizzle-kit マイグレーションコマンドのみには使用しない。
---

# Drizzle スキーマの定義

スキーマソースファイルを変更する前に、最新の公式 Drizzle PostgreSQL スキーマドキュメントを読むこと。ダイアレクトは PostgreSQL のみ。

## 必要なドキュメントレビュー

1. <https://orm.drizzle.team/docs/overview> を開き、スキーマの変更箇所を特定する。
2. 実装前に対応するドキュメントを読む：
   - スキーマレイアウトとテーブル宣言：<https://orm.drizzle.team/docs/sql-schema-declaration>
   - カラム型：<https://orm.drizzle.team/docs/column-types>
   - インデックスと制約：<https://orm.drizzle.team/docs/indexes-constraints>
   - リレーショナルクエリで使用するリレーション：<https://orm.drizzle.team/docs/relations>
   - 必要な場合の PostgreSQL スキーマ（`pgSchema`）：<https://orm.drizzle.team/docs/schemas>
   - 必要な場合のシーケンスまたはビュー：<https://orm.drizzle.team/docs/sequences>、<https://orm.drizzle.team/docs/views>
3. 読んだドキュメントの URL とスキーマの判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- マイグレーションが認識する必要のあるすべてのテーブル、enum、関連モデルをエクスポートする。
- 異なる場合は明示的な SQL カラム名を指定した TypeScript キャメルケースキーを優先する。
- 複数のテーブルで必要な共有カラムグループ（例：タイムスタンプ）はヘルパーとして抽出する。
- データベース形状を変更するスキーマ編集後は、`$migrating-drizzle-postgres` で generate → SQL レビュー → migrate を実行する。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだスキーマ機能と公式 Drizzle ドキュメント |
| 設計 | テーブル、カラム、null 許容性、一意性、参照、インデックス |
| 実装 | レビュー済みドキュメントに従ったスキーマファイルの変更 |
| 検証 | 型チェックと、データベース形状が変更された場合はマイグレーションスキルを通じた生成 SQL のレビュー |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| 新しいテーブルまたはカラム | Schema declaration と column types | テーブル名、カラム SQL 名、null 許容性、デフォルト値 |
| インデックスまたは一意制約 | Indexes and constraints | 制約名、カラム、一意性 |
| 外部キーまたは自己参照 | Schema declaration と relations | 参照先テーブル、指定された場合の on-delete 動作 |
| Enum | Schema declaration と column types | Enum 名と許可値 |
| スキーマのファイル分割 | Schema declaration organization | ファイルレイアウトと drizzle-kit スキーマパス |

## 完了チェック

スキーマの変更が完了したと報告する前に、レビューしたドキュメント、変更したスキーマモデル、検証結果を提供すること。
