---
name: querying-drizzle-sql
description: Drizzle SQL ライクな PostgreSQL クエリを記述する。select、insert、update、delete、joins、filters、transactions を含む。クエリビルダーでの CRUD や JOIN ベースのクエリ構築時に使用する。db.query リレーショナル検索、スキーマのみの編集、Pool セットアップ、drizzle-kit マイグレーションコマンドのみには使用しない。
---

# Drizzle SQL のクエリ

SQL ライクなクエリコードを変更する前に、最新の公式 Drizzle PostgreSQL クエリドキュメントを読むこと。ダイアレクトは PostgreSQL のみ。

## 必要なドキュメントレビュー

1. <https://orm.drizzle.team/docs/data-querying> を開き、クエリ形状を特定する。
2. 実装前に対応するドキュメントを読む：
   - Select：<https://orm.drizzle.team/docs/select>
   - Insert：<https://orm.drizzle.team/docs/insert>
   - Update：<https://orm.drizzle.team/docs/update>
   - Delete：<https://orm.drizzle.team/docs/delete>
   - Joins：<https://orm.drizzle.team/docs/joins>
   - フィルターと演算子：<https://orm.drizzle.team/docs/operators>
   - クエリヘルパー：<https://orm.drizzle.team/docs/query-utils>
   - 必要な場合の生フラグメント：<https://orm.drizzle.team/docs/sql>
   - 複数ステートメント書き込み：<https://orm.drizzle.team/docs/transactions>
3. 読んだドキュメントの URL とクエリの判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- 結果形状がフラットまたは JOIN 駆動の場合は SQL ライクなクエリビルダーを優先する。
- 複数テーブル書き込みは `db.transaction()` でラップし、1 つのビジネス状態遷移が一緒にコミットされるようにする。
- データベース行を API DTO にマッピングする。OpenAPI レスポンススキーマは公開コントラクトとして維持する。
- `db.query` を通じたネストされたリレーショナルフェッチが必要な場合は `$drizzle:querying-drizzle-relations` を使用する。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだクエリ機能と公式 Drizzle ドキュメント |
| 設計 | テーブル、フィルター、JOIN、書き込みセット、トランザクション境界、DTO マッピング |
| 実装 | レビュー済みドキュメントに従ったクエリの変更 |
| 検証 | 型チェック、クエリパスの自動テスト、API で公開される場合は HTTP またはユニットアサーション |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| フィルター付き select | Select と operators | From、where、order、limit |
| Join | Joins と select | Join 型、on 条件、選択カラム |
| Insert / update / delete | 該当するミューテーションドキュメント | Values または set 句、where 句、returning |
| 条件付きフィルター | Operators と data-querying compose 例 | 構成された `and` / `or` フィルターリスト |
| 複数テーブル書き込み | Transactions | トランザクション境界と失敗動作 |

## 完了チェック

クエリの変更が完了したと報告する前に、レビューしたドキュメント、変更したクエリ、検証結果を提供すること。
