# Completion checklist

## Deliverables

- [x] `docs/development/staged-development.md` が R1 を開発焦点とし、未完了 R0 を都度実装する方針を記述する
- [x] R1 縦切り（1〜7）と未完了 R0 前提の対応表が計画書にある（モバイル土台は4列に分解）
- [x] TrackPoint 自動再試行の判断タイミングが TrackPoint ステップ着手時になっている
- [x] R0〜R3 能力リストと承認済み判断（既存項目）を維持している
- [x] セッション design / plan / specification-review / transcript が揃っている

## Verification

- [x] 進捗状況が R1 進行中＋都度 R0 を肯定形で述べる
- [x] 導入済みは Compose PostgreSQL / Drizzle client までとし、PostgreSQL schema / migration は表のステップ前提列で扱う
- [x] 対応表に PostgreSQL schema / migration 列があり、アカウントは owners・表示名を必須とする
- [x] 対応表の前提説明が Cognito ≠ モバイル認証状態、永続キュー ≠ SQS を区別する
- [x] Dog 行の S3 は `—` とし、Avatar / S3 は R2 前提として肯定形で示す
- [x] Active Walk は foreground / background、Event は latitude / longitude を必須前提とする
- [x] 品質ゲート follow-up 文書への参照が進捗に残る
- [x] 独立レビュー指摘を反映し、再レビューで未解決 0 を確認する
