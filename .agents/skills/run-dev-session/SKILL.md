---
name: run-dev-session
description: Use when starting or continuing a development session.
---

# 開発セッションの実行

1 セッションは 1 目的。このスキルはフェーズとゲートだけを定義する。手順はサブスキルに任せる。パスとプロジェクト規約は AGENTS.md から読む。

変更に description が当たるスキルは、編集前に読む。

## フェーズ

1. **目的** — 未確定なら `brainstorming` で探索し、確認を取る。確定した目的以外では実行しない。
2. **隔離** — `using-git-worktrees` で作業空間を用意する。所有ワークツリーはセッション記録に残す。
3. **記録** — AGENTS.md が示すセッションディレクトリにトランスクリプトを開き、目的・ベースライン・成果物を残す。記録が変わったら、主張が食い違わないよう更新してから次へ進む。
4. **仕様** — `confirming-development-specifications`。`ready` のときだけ設計へ進む。
5. **設計と計画** — `brainstorming` で設計を固め、`writing-plans` で実装計画を書く。承認を待つ。
6. **実装** — 承認済み計画を `subagent-driven-development`（サブエージェント可）または `executing-plans` で実行する。進捗はライブ todos。
7. **レビュー** — `requesting-code-review`。Critical / Important が残るあいだ公開しない。指摘対応は `receiving-code-review`。
8. **公開** — `finishing-a-development-branch` の PR 経路。完了主張の前に `verification-before-completion`。
9. **マージ後** — `retrospecting-dev-session`。承認されたスキル変更だけ実装する。
10. **片付け** — `finishing-a-development-branch` の cleanup。記録した所有ワークツリーを対象にする。

## ゲート

- 目的が未確認ならファイルを変えない
- 仕様レビューが `ready` 以外なら設計・実装しない
- 計画レベルの判断は、プロジェクトの計画書へ同期するまで次の判断や実装に進まない
- セッション記録の主張が食い違うあいだ、レビューと公開をしない
- Critical / Important が残るあいだ merge-ready にしない

## 判断

ユーザーの承認が要るときは、効果を 1 文で述べる質問を 1 つだけする。
