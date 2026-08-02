# Retrospective

- status: ready-to-implement applied
- session: `20260802163519-advance-r1-just-in-time-r0`
- merged PR: https://github.com/matsuokashuhei/walk-dog/pull/26
- merge commit: `22be47017d3e8de6dd366320c99e8cf62046c8c2`

## Findings

### F1 — Coarse mobile R0 grouping forced a user correction

- **trigger:** R0↔R1 対応を「モバイル土台（認証・API・永続キュー・位置）」1列で提示した。
- **missed behavior:** ユーザーが粒度が大きいと指摘し、4列への分解を求めた。
- **desired behavior:** 段階計画や前提対応を示すとき、モバイル R0 は最初から認証状態 / API クライアント / 永続送信キュー / iOS 位置情報権限に分け、Cognito（API）および SQS（サーバー）と混同しない。
- **skill action:** Update `.agents/skills/confirming-development-specifications/SKILL.md` — add a release-prerequisite decomposition rule for mobile R0 and Cognito vs SQS distinctions when mapping unfinished foundations to later-release steps.

### F2 — Plan table shipped before spec/release-boundary cross-check

- **trigger:** 合意表をそのまま `staged-development.md` に書き、独立レビュー前に Dog Avatar/S3・Start 位置・Event 座標・hedged セルが入った。
- **missed behavior:** レビューが §R1/R2/R3 分割と `external-specification.html` の Start / Event 契約との不一致を検出した。
- **desired behavior:** 計画書の前提表を書く／更新する前に、各セルを現行リリース能力・後続リリース境界・仕様の前提条件と突き合わせ、肯定形の前提ラベルだけを残す。
- **skill action:** Update `.agents/skills/run-dev-session/SKILL.md` §Development Plan Sync — require a prerequisite-table cross-check against staged release sections and relevant `docs/specs/` before marking a plan-level table synced; keep AGENTS.md affirmative wording.

### F3 — “導入済み” claimed without implementation evidence

- **trigger:** 進捗に「PostgreSQL migration」を導入済みと書いたが、worktree には Compose PostgreSQL と Drizzle client しかなかった。
- **missed behavior:** 独立レビューが過大表記を指摘し、後続セッションが schema 作業を省略しうる状態だった。
- **desired behavior:** 計画書の導入済み記述は、リポジトリ上の成果物パス（schema / migration SQL / workflow 等）を確認してから書く。未確認なら未完了 R0 / JIT 前提に残す。
- **skill action:** Update `.agents/skills/confirming-development-specifications/SKILL.md` — require implementation evidence paths for any “already delivered / 導入済み” conclusion in source maps and plan updates.

### F4 — Spec review Gaps over-certified table consistency

- **trigger:** `specification-review.md` の Gaps checked が、計画・仕様・セッション合意の一致を宣言したまま、未検証の表を `ready` にした。
- **missed behavior:** レビューが「ゲート記録が成果物を過大認証している」と指摘した。
- **desired behavior:** 表や進捗の計画同期を含むセッションでは、Gaps checked に具体的な突き合わせ項目（リリース境界、仕様前提、実装証拠）を列挙し、未検証なら `ready` にしない。
- **skill action:** Same skill as F2/F3 (confirming-development-specifications Completion record) — Gaps checked must list concrete cross-checks for plan tables and delivered claims; shared root cause with F2/F3.

## Proposed skill changes

| ID | Action | Path | Section intent |
| --- | --- | --- | --- |
| S1 | Update | `.agents/skills/confirming-development-specifications/SKILL.md` | Prerequisite decomposition (mobile R0 columns; Cognito ≠ mobile auth state; persistent queue ≠ SQS); implementation evidence for 導入済み; Gaps checked must enumerate cross-checks for plan tables |
| S2 | Update | `.agents/skills/run-dev-session/SKILL.md` | Development Plan Sync: before syncing a prerequisite table, cross-check release boundaries + specs + affirmative precondition labels |

F2/F3/F4 share one root cause (plan sync without evidence/cross-check); S1+S2 cover them without a new skill.

## Outcomes

- Skill edits: applied after user approval (`Ok`)
  - S1: `.agents/skills/confirming-development-specifications/SKILL.md` — mobile R0 decomposition, delivered-claim evidence, Gaps checked cross-checks, plan-table readiness gate
  - S2: `.agents/skills/run-dev-session/SKILL.md` — Development Plan Sync prerequisite-table cross-check steps
- Follow-up PR: https://github.com/matsuokashuhei/walk-dog/pull/27
