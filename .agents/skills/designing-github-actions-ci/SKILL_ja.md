---
name: designing-github-actions-ci
description: 公式ガイドに基づいて高品質な GitHub Actions CI を設計する。ゲートテーブル、再利用可能ワークフロー、並列ジョブ、低コンテキスト名、最小権限、SHA 固定アクションを含む。.github/workflows 配下のワークフローファイルの設計・変更、それらのワークフローを実行する CI ジョブ、ワークフローとして実装された公開パイプラインの設計・変更時に使用する。CI に関するスキルやドキュメントのみを作成する場合、または Actions に関係ないアプリケーション機能コードには使用しない。
---

# GitHub Actions CI の設計

ワークフローを設計または変更する前に、最新の公式 GitHub Actions ドキュメントを読むこと。YAML を配線する前に、各ゲートが WHAT（何を検証するか）を設計する。

## 必要なドキュメントレビュー

1. トリガー、ジョブ、権限、マトリックス戦略を変更する前に <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax> を開く。
2. 2 つ以上の呼び出し元が同じステップを共有する場合、または `workflow_call` を導入する場合に <https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows> を開く。
3. 権限、シークレット、サードパーティ `uses:` の固定を設定する前に <https://docs.github.com/en/actions/reference/security/secure-use> と <https://docs.github.com/en/actions/how-tos/secure-your-work> を開く。
4. 読んだドキュメントの URL と CI 設計の判断を、アクティブセッションの設計、計画、またはプルリクエストの説明に記録する。

## 設計順序

ワークフロー YAML を書く前に、以下の順序で完了する：

1. **WHAT** — 各ゲートまたはジョブについて、コマンド、検証内容、失敗条件を記録する。
2. **Local vs CI** — ローカル便利スクリプト（例：逐次 `npm run check`）と CI が異なるかどうかを明示する。独立したゲートは CI 上で並列実行する。ゲートが個別に実行可能な場合、Actions で単一の逐次スクリプトを強制しない。
3. **HOW** — 呼び出し元、再利用可能な `workflow_call`、マトリックス vs 個別ジョブ、パスフィルター、ランタイムバージョン、`working-directory`。
4. **セキュリティデフォルト** — 最小 `permissions`、サードパーティ Actions をバージョンコメント付きの完全なコミット SHA に固定、必要なシークレットのみを渡す（信頼できない呼び出し元には広範な継承よりも明示的なシークレットを優先する）。

ゲート WHAT テーブルが存在する前に、パスフィルター、ファイルリスト、再利用可能レイアウトを提示しない。

## プロジェクトのデフォルト

- ワークフローは `.github/workflows/` に配置する。
- 2 つ以上の呼び出し元が同じインストール＆ゲートステップを重複する場合は、`on: workflow_call` で再利用可能ワークフローを抽出し、`uses: ./.github/workflows/<name>.yml` で呼び出す。
- lint、jscpd、knip、typecheck などの独立した静的ゲートには並列ジョブ（マトリックス許可）を優先する。
- 低コンテキストなワークフローとジョブの表示名（`publish`、`lint`、`pull-request`）を使用する。`Main publish` や `API quality gate` などの冗長な修飾語は削除する。
- パッケージランタイムをそのパッケージの Dockerfile または文書化された Node バージョンに一致させる。
- コンテナイメージ公開、クラウドデプロイ ID 連携、コードスキャン結果アップロード、依存関係サービス E2E は、現在の目的に含まれない場合は個別の設計スライスとして維持する。`docs/development/staged-development.md` が既に具体的なメカニズムを指定している場合、セッション設計スライスリストではその名前のみを使用する。

## ワークフロー

| フェーズ | 提供内容 |
| --- | --- |
| ドキュメントレビュー | 構文、再利用、セキュアユースに関する公式 URL の参照 |
| 設計 | ゲート WHAT テーブル、Local vs CI 形状、再利用/並列/命名の判断、権限と固定戦略 |
| 実装 | 記録された設計に一致するワークフロー YAML |
| 検証 | ワークフロートリガー、ジョブ名、SHA 固定、PR またはプッシュで変更を実行した Actions の成功実行 |

## 完了チェック

CI 設計またはワークフローの変更が完了したと報告する前に、以下を提供すること：

- レビューしたドキュメント URL
- ゲート WHAT テーブル
- 再利用、並列、命名の判断
- サードパーティ Actions が完全なコミット SHA を使用していることの確認
- Actions または同等の YAML 静的レビューによる検証結果
