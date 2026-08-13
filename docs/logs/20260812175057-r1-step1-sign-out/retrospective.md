# Retrospective — R1 Step 1 Sign Out

- Date: 2026-08-13
- Merged PR: https://github.com/matsuokashuhei/walk-dog/pull/49
- Merge commit: `c0120d129c3df3efc324a8761a800d948b119788`
- Status: implemented
- Evidence: this conversation’s user instructions 4, 10, and 12

## Findings

### 1. 画面と API の仕様提示をユーザーが指示した（指示 4）

- **Trigger:** 目的承認後、エージェントは `specification-review.md` まで進み、画面/API 契約の提示を待った。
- **Missed behavior:** ユーザーが HTML モック、コンポーネント一覧、イベント一覧、API のリクエスト/レスポンス/振る舞いの提示を指示した。
- **Desired behavior:** 仕様確認中に、画面と HTTP API の契約をユーザーが頼む前に提示する。
- **Skill action (applied):** `confirming-development-specifications` に Product contract presentation を追加。`explaining-specifications-and-design` の WHAT 完了条件に同じ成果物を必須化。`run-dev-session` 実行セッションで提示済みを必須にした。

### 2. スキル準拠レビューをユーザーが指示した（指示 10）

- **Trigger:** PR 公開後、エージェントはスキル準拠のサブエージェントレビューを始めなかった。
- **Missed behavior:** ユーザーが `.agents/skills` 準拠のサブエージェントコードレビューを依頼した。
- **Desired behavior:** Crit APPROVED のあと、Publish の前にスキル準拠レビューを実行する。Critical / Important が 0 になるまで merge-ready にしない。
- **Skill action (applied):** `creating-pull-requests` の既定をスキル準拠レビューにした。`run-dev-session` の Crit 後・Publish 前に必須サブスキルとして固定した。

### 3. Sign Out だけ `lib/sign-out.ts` を切った（指示 12）

- **Trigger:** エージェントは `signOutRequest` を `lib/sign-out.ts` に切り、Sign In / Sign Up / Verify は route 内の `apiRequest` のままにした。
- **Missed behavior:** ユーザーが「なぜ Sign Out の API だけそのファイルがあるのか」と尋ね、揃え方を確認したうえで揃えるよう指示した。
- **Desired behavior:** `/v1/<feature>/*` は `lib/<feature>-api.ts` にまとめ、endpoint ごとのファイルは作らない。同じ機能のインライン呼び出しも同じ変更で移す。
- **Skill action (applied):** `organizing-mobile-api-clients` を作成し、モバイルのネットワーク呼び出し追加・移動時に `run-dev-session` から必須にした。

## Skill outcomes

| Action | Path | Result |
| --- | --- | --- |
| Update | `.agents/skills/confirming-development-specifications/SKILL.md` | Product contract presentation before ready |
| Update | `.agents/skills/explaining-specifications-and-design/SKILL.md` | Screen/API WHAT artifacts required |
| Update | `.agents/skills/run-dev-session/SKILL.md` | Spec presentation, skill-compliance review, mobile API client hooks |
| Update | `.agents/skills/creating-pull-requests/SKILL.md` | Default skill-compliance review before publish |
| Create | `.agents/skills/organizing-mobile-api-clients/SKILL.md` | Feature-level `lib/<feature>-api.ts` |
