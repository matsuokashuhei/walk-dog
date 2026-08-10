---
name: transforming-zod-schemas
description: Zod 4 のリファインメント、チェック、トランスフォーム、パイプ、コーデック、デフォルト、ブランド型を追加・変更する。.refine、.check、.transform、.pipe、z.codec、.default、.catch、.brand の編集時に使用する。ベーススキーマ形状のみ、parse / safeParse 呼び出し箇所のみ、エラーフォーマットのみ、JSON Schema 変換のみ、Hono バリデーターのみ、OpenAPI ルート配線のみには使用しない。
---

# Zod スキーマの変換

スキーマエフェクトを変更する前に、最新の公式 Zod 4 リファインメント、トランスフォーム、コーデックドキュメントを読むこと。クラシック `zod` パッケージ API のみを使用する。

## 必要なドキュメントレビュー

1. <https://zod.dev/api?id=refinements> を開き、変換の変更箇所を特定する。
2. 実装前に対応するドキュメントを読む：
   - リファインメントとチェック：<https://zod.dev/api?id=refine>、<https://zod.dev/api?id=check>
   - トランスフォームとパイプ：<https://zod.dev/api?id=transforms>、<https://zod.dev/api?id=pipes>
   - デフォルト、prefaults、catch：<https://zod.dev/api?id=defaults>、<https://zod.dev/api?id=prefaults>、<https://zod.dev/api?id=catch>
   - 必要な場合のブランド型：<https://zod.dev/api?id=branded-types>
   - 双方向コーデック：<https://zod.dev/codecs>
3. 読んだドキュメントの URL と変換の判断を、アクティブセッションログ、設計、またはプルリクエストの説明に記録する。

## プロジェクトのデフォルト

- `import { z } from 'zod'` でインポートする（Zod 4 クラシック API）。
- Zod 4 ネイティブのカスタムバリデーションには `.check()` を優先する。既存のスキーマが既に使用している場合は `.refine()` を維持する。
- エンコードとデコードの両方が重要な場合は `z.codec()` を優先し、単方向の出力整形には `.transform()` を優先する。
- 単方向 `.transform()` は `encode` をブロックすることを認識する。トランスフォームを含むスキーマにエンコードパスを追加しない。
- パース時に欠落値を補うには `.default()` を優先する。環境変数文字列が数値になる場合など、`z.coerce.number()` のような coerce ヘルパーを文書化する。
- トランスフォーム追加後は `$zod:parsing-zod-data` で呼び出し箇所を更新し、`z.input` / `z.output` が正確に保たれるようにする。
- HTTP バリデーターの配線は `$hono:validating-hono-requests` に留める。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 読んだ変換機能と公式 Zod ドキュメント |
| 設計 | 方向（単方向 vs コーデック）、失敗メッセージ、入出力型 |
| 実装 | レビュー済みドキュメントに従った refine、transform、pipe、codec、または default の変更 |
| 検証 | 型チェックと、受け入れ・拒否された入力の両方のアサーション。コーデック使用時はエンコードパスも |

## よくある判断

| リクエスト | 実装前に読むもの | 記録 |
| --- | --- | --- |
| クロスフィールドまたはカスタムルール | Refinements と checks | ルール、パス、エラーメッセージ |
| 単方向の値書き換え | Transforms | 入力型、出力型、非同期必要性 |
| 双方向エンコード/デコード | Codecs | 入力スキーマ、出力スキーマ、decode / encode |
| 欠落値のフォールバック | Defaults と catch | Default または catch 値と方向の制限 |
| 名目型付け | Branded types | ブランド名と使用箇所 |
| 文字列から数値への環境変数 coerce | Coercion と defaults | Coerce ヘルパーとデフォルト |

## 完了チェック

変換の変更が完了したと報告する前に、レビューしたドキュメント、変更したスキーマエフェクト、検証結果を提供すること。
