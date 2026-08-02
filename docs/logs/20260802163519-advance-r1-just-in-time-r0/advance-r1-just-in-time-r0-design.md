# Design: Advance R1 with just-in-time R0

## WHAT

段階開発計画は次を提供する。

1. 開発焦点は R1（散歩記録の縦切り）。未完了の R0 能力は残し、必要な R1 ステップの直前に実装する。
2. R1 縦切り（1〜7）と未完了 R0 前提の対応表（モバイル土台は認証状態 / API クライアント / 永続送信キュー / 位置権限に分解）。
3. TrackPoint 自動再試行の回数・時間上限は、R1 の TrackPoint ステップ着手時に確定する。

R0〜R3 の提供能力リスト、承認済み判断、公開インターフェース、検証条件は維持する。

## HOW

`docs/development/staged-development.md` を更新する。

- 冒頭の agent 向け着手案内を、R1 進行中の都度 R0 実装に合わせて更新する。
- §進捗状況を R1 焦点と都度 R0、導入済み品質ゲートへの参照に更新する。
- §R1 縦切りと R0 前提の対応を新設し、合意した表を載せる。
- §リリース開始時に確定する判断の TrackPoint 項目を、TrackPoint ステップ着手時に合わせる。

## WHY

R1 前半に必要な R0 は Cognito とモバイル認証／API クライアント（およびアカウント着手時の owners schema/migration）に限られ、キュー／worker は TrackPoint 以降で足りる。焦点と前提表を計画の正本にすると、以降のセッションが同じ順序で着手できる。

## Review fixes

独立レビュー後に次を反映した。

- Dog 行から R2 の Avatar/S3 前提を外す
- Active Walk の位置前提を foreground / background 必須にする
- Event の位置前提を latitude / longitude 必須にする
- 進捗の「PostgreSQL migration 導入済み」を Compose PostgreSQL / Drizzle client に正し、owners migration をアカウント着手時前提とする
- 表の凡例とセルを肯定形の前提ラベルへ揃える
