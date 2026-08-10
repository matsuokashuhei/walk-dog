---
name: querying-drizzle-relations
description: Drizzle リレーショナルクエリを db.query、findMany、findFirst、includes によるネストで記述する。手動 JOIN なしでネストされた PostgreSQL リレーションを取得する際に使用する。SQL ライクな select / join CRUD、スキーマのみの編集、Pool セットアップ、drizzle-kit マイグレーションコマンドのみには使用しない。
---

# Drizzle リレーションのクエリ

`db.query` コードを変更する前に、最新の公式 Drizzle リレーショナルクエリドキュメントを読むこと。ダイアレクトは PostgreSQL のみ。

## 必要なドキュメントレビュー

1. リレーショナルクエリコードを変更する前に <https://orm.drizzle.team/docs/rqb> を開く。
2. 実装前に対応するドキュメントを読む：
   - RQB に必要なリレーション宣言：<https://orm.drizzle.team/docs/relations-schema-declaration>
   - グラフエッジ宣言時のソフトリレーション：<https://orm.drizzle.team/docs/relations>
   - RQB と SQL ライクの選択のためのクエリ概要：<https://orm.drizzle.team/docs/data-querying>
3. Drizzle クライアントがテーブルとリレーションをエクスポートするスキーマモジュールで初期化されていることを確認する。
4. 読んだドキュメントの URL とクエリの判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- 結果が 1 ラウンドトリップのネストされたリレーショナルデータであるべき場合は `db.query` を使用する。
- スキーマモジュールでリレーションを宣言し、`db.query` を使用する前にそれらのモジュールを `drizzle()` に渡す。
- ネストされたクエリ結果を API DTO にマッピングする。OpenAPI レスポンススキーマは公開コントラクトとして維持する。
- フラットな CRUD、明示的な JOIN、セットベースの更新が必要な場合は `$drizzle:querying-drizzle-sql` を使用する。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだリレーション機能と公式 Drizzle ドキュメント |
| 設計 | ルートテーブル、`with` グラフ、フィルター、順序、limit / offset、DTO マッピング |
| 実装 | レビュー済みドキュメントに従った `db.query` の変更 |
| 検証 | 型チェック、ネストされた形状の自動テスト、API で公開される場合は HTTP またはユニットアサーション |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| ネストされた include | RQB include relations | ルートクエリ、`with` ツリー |
| 部分フィールド選択 | RQB partial fields | リレーションごとの選択カラム |
| リレーションフィルター | RQB filters | ルートとネストされたリレーションの Where |
| ページネーションまたは順序付け | RQB limit / offset と orderBy | Limit、offset、order 式 |
| `db.query` テーブルが見つからない | Relations declaration と client schema import | エクスポートされたリレーションと drizzle() スキーマ |

## 完了チェック

リレーショナルクエリの変更が完了したと報告する前に、レビューしたドキュメント、変更した `db.query` パス、検証結果を提供すること。
