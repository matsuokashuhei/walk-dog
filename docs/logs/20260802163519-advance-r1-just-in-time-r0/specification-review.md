# Specification review

- status: ready
- purpose: Advance active development to R1 and treat remaining R0 work as just-in-time prerequisites; update `docs/development/staged-development.md` and record the R1↔R0 prerequisite table
- active release: R1（散歩記録の縦切り）を開発焦点とする。未完了の R0 能力は R1 各ステップの前提として都度実装する
- next permitted action: design

## Confirmed purpose

段階開発計画の進捗と着手方針を更新し、R1 を現行の開発焦点とする。未完了の R0 基盤はリリース能力として残し、R1 縦切りステップの直前に実装する。セッションで合意した R1↔R0 前提対応表を計画書に記録する。

## Source map

| Conclusion | Source |
| --- | --- |
| R0 は進行中で API 基盤を進めると記録されている | `docs/development/staged-development.md` §進捗状況 |
| R0 能力: Cognito、AWS 接続、ヘルス、モバイル認証状態・API クライアント・永続キュー・位置、ECR 等 | `docs/development/staged-development.md` §R0: 開発基盤 |
| R1 能力: アカウント、Dog、Active Walk、TrackPoint、Finish、Event/Detail、実機検証 | `docs/development/staged-development.md` §R1: 散歩記録の縦切り |
| R1 開始時に TrackPoint 自動再試行の回数と時間上限を確定する | `docs/development/staged-development.md` §リリース開始時に確定する判断 |
| API 品質ゲートのローカルと CI は導入済み、follow-up 残あり | `docs/development/staged-development.md` §進捗状況; `docs/development/2026-08-02-r0-api-quality-gate-follow-ups.md` |
| 認証は Cognito、TrackPoint は SQS→DynamoDB、Avatar は S3 | `docs/development/staged-development.md` §承認済みの判断; Architecture |
| R0 API 設計は Cognito 検証、Compose の ElasticMQ / DynamoDB Local / RustFS、worker ヘルスを定義する | `docs/specs/2026-07-26-hono-api-r0-design.md` §認証, §AWS連携, §ヘルスチェック, §Dockerと設定 |
| モバイルは認証付き API を呼び出し、Walk は位置情報と TrackPoint / Event 送信を行う | `docs/specs/external-specification.html` Walk画面 / Walk API |
| ユーザーが R1 進行と R0 都度実装、および対応表の計画書反映を承認した | session transcript 20260802163519 |

## Current-release deliverables

- `docs/development/staged-development.md` の進捗状況を、R1 を開発焦点とし未完了 R0 を都度実装する方針へ更新する。
- R1 縦切りステップ（アカウント〜実機検証）と、未完了 R0 前提（Cognito、モバイル認証状態、API クライアント、永続送信キュー、位置権限、AWS 接続、Compose 互換、worker/ヘルス、Docker/ECR）の対応表を計画書に追加する。
- R1 開始時判断の TrackPoint 自動再試行は、TrackPoint ステップ着手時に確定する旨を計画書に反映する。
- R0 セクションの能力一覧は削除せず、未完了項目が R1 前提として残ることを進捗から参照できるようにする。

## Acceptance conditions

- 計画書を読むと、現行の開発焦点が R1 であることと、未完了 R0 をステップ直前に実装する方針が肯定形で分かる。
- 対応表がセッションで合意した分解粒度（モバイル土台を4列に分けた表）と一致する。
- R0 / R1 / R2 / R3 の提供能力リスト自体は、今回の方針変更で削らない。

## Decision classifications

| Decision | Classification | Notes |
| --- | --- | --- |
| 開発焦点を R1 に進め、未完了 R0 は R1 各ステップの前提として都度実装する | Plan-level | 進捗・着手順序。ユーザー承認済み。`staged-development.md` へ同期する |
| R1↔R0 前提対応表を計画書に記録する | Plan-level | 同上。セッション合意表を正本化する |
| TrackPoint 自動再試行の回数・時間上限は TrackPoint ステップ着手時に確定する | Plan-level | 「R1開始時」判断のタイミングを縦切り順序に合わせる |
| 品質ゲート follow-up（SARIF / e2e / knip / mobile gates）の実施時期 | Deferred / outside product path | 製品縦切りの必須前提ではなく、検証の厚み。既存 follow-up 文書に残す |
| 個別 R0 項目の実装設計（Cognito 配線、Compose YAML 等） | Implementation-local（後続セッション） | 本セッションは計画書更新のみ |

## Verification conditions

- 更新後の `staged-development.md` が進捗、都度実装方針、対応表、TrackPoint 判断タイミングを含む。
- 承認済みの判断・R0〜R3 能力・公開インターフェース・検証の既存記述と矛盾しない。

## Gaps checked

- 必要ソースは存在し、計画レベル判断はユーザー承認済みで、`awaiting-confirmation` ではない。
- 本セッションは製品コード変更を含まない。
- 独立レビュー後の修正: Dog 行の S3 を `—`、Active Walk の foreground/background、Event の latitude/longitude 必須、進捗の migration 過大表記の修正、PostgreSQL schema / migration 列の追加、表セルの前提表現の肯定形化。修正後の表は §R1/R2 分割と `docs/specs/external-specification.html` の Start / Event 契約と一致する。
