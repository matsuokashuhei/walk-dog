---
name: retrospecting-dev-session
description: Use when a session pull request has merged into main, or when the user asks for a session retrospective. Do not use for product feature work unrelated to agent process.
---

# 開発セッションの振り返り

ユーザー修正とレビュー指摘をスキル変更に変換する。ソフトな助言は成果ではない。

## ワークフロー

1. セッション記録とマージ済み PR から証拠を集める: トランスクリプト、レビュースレッド、ユーザーの方向転換、延期したフォローアップ。
2. 各発見をトリガー、見逃した動作、望ましい動作として書く。
3. すべての発見にスキルアクションを提案する:
   - 名前付きスキルの作成または更新
   - AGENTS.md へのプロジェクト規約の追加
   - `run-dev-session` に領域スキルの列挙を足さない
4. セッションディレクトリに `retrospective.md` を書く。ステータスは `awaiting-approval` または `ready-to-implement`。
5. 提案を提示する。スキル編集は明示承認のあとだけ実装する。
6. 公開とワークツリー片付けは `run-dev-session` に返す。

## 品質

- すべての発見がスキルの作成・更新、または AGENTS.md の規約変更に対応する
- 修正を防げた最小の変更を優先する
- 複数の発見が同じ根本原因なら、1 つの変更でカバーしてよい。その旨を書く

## スコープ外

- エージェントプロセスに関係ないプロダクト機能
- フォローアップ PR の作成
- ワークツリーの片付け
- プルリクエストのマージ
