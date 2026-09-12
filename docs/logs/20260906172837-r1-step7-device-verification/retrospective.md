# Retrospective — R1 Step 7 device verification

- Date: 2026-09-12
- Merged PR: https://github.com/matsuokashuhei/walk-dog/pull/100
- Merge commit: `f04805c`
- Status: implemented
- Evidence: session transcript, SDD progress ledger, final review (deferred minors), PR #100 (no review threads)

## Findings

Trigger と Desired は今回の事例。Skill action は別セッションでも使える規則として提案する。

### 1. 監視ループが重複し、Task 4 完了後も通知が続いた

- **Trigger:** ユーザー「常に監視しろ」で Task 4 用 120s ループを再武装。progress: PID `93190` 停止後に再武装 → Task 4 `DONE_WITH_CONCERNS` 後も旧ループが tick し通知を溢れさせた。
- **Missed behavior:** 再武装前に既存 `AGENT_LOOP_TICK_task4` を列挙・停止せず、完了時も最新 PID だけ kill した。`loop` の重複禁止と `recording-ios-e2e-evidence` の停止手順が効いていない。
- **Desired behavior:** 同一 purpose の監視は常に 1 本。再武装前に既存ループを全停止。タスク合格・委任完了・ユーザー停止のいずれかで purpose 一致の全 PID / ターミナルを kill し、await で完了通知を消費する。
- **Skill action:** `recording-ios-e2e-evidence` — 監視再武装前の既存ループ全停止と、合格判定時の purpose 一致一括停止を必須化。`subagent-driven-development` — 長時間タスク監視でも同じ単一ループ規則を短く委任。

### 2. CloudWatch OTP 取得が auto-review と非 TTY で止まった

- **Trigger:** Task 4 が Verify で BLOCKED。OTP 取得が Cursor auto-review 承認タイムアウト。回避は docker `aws-cli`（`-ti` なし）+ jq。シェル `aws` エイリアスは非 TTY で壊れる。
- **Missed behavior:** 対話的 `aws` / TTY 付き docker を agent 実行で使い、リポジトリ OTP スクリプトの非 TTY 経路を優先しなかった。
- **Desired behavior:** Cognito OTP は `apps/mobile/scripts/e2e/fetch-cognito-otp.sh`（または同等の非 TTY 固定スクリプト）経由のみ。ホスト `aws` は `type -P` の実バイナリか docker `--rm`（`-ti` 禁止）。SSO は Verify 前に `aws sts get-caller-identity` で確認。
- **Skill action:** `recording-ios-e2e-evidence` — OTP は repo スクリプト経由・非 TTY docker・SSO 事前確認を手順に固定。スクリプト側は jq 抽出と `-ti` 不使用を AGENTS または README に短く明記（実装は別 PR）。

### 3. 実機 E2E の前提確認が後回しで、複数回 BLOCKED した

- **Trigger:** Task 4 が PLA 未承諾、iPhone ロック、CoreDevice HID 非対応（iOS 26.6.2）で連続 BLOCKED。最終的に iPhone Mirroring + Cursor Accessibility で突破。
- **Missed behavior:** シナリオ開始前に署名・端末ロック・SSO・入力経路（CoreDevice vs Mirroring）を一括 preflight しなかった。
- **Desired behavior:** 物理 iPhone E2E 着手前に checklist を通す: 実機 listed / ロック解除 / PLA+プロファイル / `aws sso login` / iOS 26+ なら Mirroring+Accessibility を先に有効化。未充足なら implementer を出さず人間待ち。
- **Skill action:** `recording-ios-e2e-evidence` — 物理実機 preflight チェックリスト節を追加（署名・ロック・SSO・Mirroring 分岐）。

### 4. brief / モックアップの文言が製品 UI とずれた

- **Trigger:** final-review minor — brief/mockups: **散歩中** / **Ready に戻る**、製品: **記録中** / **Ready へ戻る**。レポートと PNG は製品に一致。
- **Missed behavior:** 画面契約モックアップと E2E brief が main の現行コピーを取り込まず、検証者が期待ラベルを誤認しうる状態だった。
- **Desired behavior:** デバイス検証用 brief / モックアップは shipped UI 文字列を正本にする。意図的差分のみ explicit に記載。
- **Skill action:** `confirming-development-specifications` — 画面契約モックアップ提示時、main の現行 UI コピーと一致させるか差分を一覧する。

### 5. セッション docs コミット後も transcript の HEAD が古い

- **Trigger:** final-review minor — `transcript.md` が HEAD `6c5785b` のまま。実 HEAD `bb9cee1`（`0f586ec` session docs + `bb9cee1` polish）。
- **Missed behavior:** Task 5 で session docs を commit したが、Completion の commit 一覧と HEAD を同ターンで更新しなかった。`run-dev-session` の「記録の食い違い」ゲートに触れる。
- **Desired behavior:** session docs / e2e-report 更新コミットには、transcript の Completion（HEAD・commit 一覧・gate 結果）の同期を含める。
- **Skill action:** `run-dev-session` — 記録フェーズ: session 成果物コミット前に transcript Completion を HEAD と一致させるチェックを追加。

### 6. 既存 mobile lint 失敗を gate が曖昧に報告した

- **Trigger:** Task 5 — mobile lint FAIL（7 件、reconcile 外の pre-existing）。implementer `DONE_WITH_CONCERNS`、final review は non-block と判定。
- **Missed behavior:** lint 赤を pre-existing と introduced の区別なく報告し、merge 可否の判断材料が弱かった。
- **Desired behavior:** lint 失敗時は変更ファイル外のみなら `pre-existing` とファイル一覧を evidence 付きで報告。新規導入なら修正まで merge-ready にしない。
- **Skill action:** `verification-before-completion` — lint/typecheck 失敗時、diff 触媒ファイルか pre-existing かを必ず分類して報告する。

## Skill outcomes

| Action | Path | Result |
| --- | --- | --- |
| Update | `.agents/skills/recording-ios-e2e-evidence/SKILL.md` | implemented |
| Update | `.agents/skills/subagent-driven-development/SKILL.md` | implemented |
| Update | `.agents/skills/confirming-development-specifications/SKILL.md` | implemented |
| Update | `.agents/skills/run-dev-session/SKILL.md` | implemented |
| Update | `.agents/skills/verification-before-completion/SKILL.md` | implemented |