# Retrospective — R1 Step 2 Dog list, register, profile

- Date: 2026-08-15
- Merged PR: https://github.com/matsuokashuhei/walk-dog/pull/56
- Merge commit: `73c091d93eda939af22032db29a0f1a3c42d88e7`
- Status: implemented
- Evidence: session transcript (POST spec HTML, rulings wording, Cursor Simple Browser, review comment), PR review on `0001_create_dogs_and_goal_revisions.sql`, Task 6 invalid screenshot loop, merge 後にユーザーが次工程を尋ねたこと

## Findings

### 1. POST 成功応答の `currentGoal` を HTML 仕様の POST 節に書かなかった

- **Trigger:** ユーザーが `Show the spec for currentGoal of POST/v1/dogs API` のあと、`POST /v1/dogsにこの仕様も書いてください。` と指示した。
- **Missed behavior:** GET と同じ `currentGoal` 形状は会話と GET 節にはあったが、POST 201 の HTML 節には無かった。
- **Desired behavior:** メソッドごとの成功 Body は、そのメソッドの HTML 節に全部書く。POST が Dog と一緒に返す `currentGoal` は POST 201 に書く。
- **Skill action:** `confirming-development-specifications` の API HTML 完了条件に、各 method の成功 Body をその method 節へ置くことを足す。

### 2. 1 ファイルに複数 `CREATE TABLE` を残した

- **Trigger:** PR レビューが `0001_create_dogs_and_goal_revisions.sql` を `0001_create_dogs.sql` と `0002_create_goal_revisions.sql` に分け、Cursor ルール化を求めた。
- **Missed behavior:** `drizzle-kit generate` の 1 回分を 1 SQL ファイルのまま commit した。
- **Desired behavior:** SQL ファイルは `CREATE TABLE` 1 つ。enum / unique / FK はそのテーブルのファイルに置く。generate 後に複数テーブルなら分割する。
- **Skill action:** `#56` の `aafd8de` で `migrating-drizzle-postgres` と `.cursor/rules/drizzle-one-table-per-migration.mdc` を更新済み。追加のスキル変更はしない。

### 3. Ruling の説明が「何を決めたか」になっていなかった

- **Trigger:** ユーザーが `Rulings I madeをもっと詳しく説明して`、続けて `何を決めたかを明確に書いて` と指示した。
- **Missed behavior:** 衝突の経緯と外れたときのコストから書き、決定文が埋まった。
- **Desired behavior:** Ruling は決定そのものを先に、肯定形の短い文で列挙する。経緯は聞かれたときだけ。
- **Skill action:** 今回は実装しない。

### 4. Invalid の E2E PNG が Idle だった

- **Trigger:** Task 6 レビューが `ios-dog-new-invalid.png` を DOG-03 Idle（検証メッセージなし）と判定した。
- **Missed behavior:** 送信不可の空フォームを Invalid として保存した。
- **Desired behavior:** 入力エラー証跡は検証メッセージと再試行操作が見える。送信しない契約でも、client invalid を撮る。Idle を Invalid と名乗らない。
- **Skill action:** `recording-ios-e2e-evidence` の入力エラー行を、メッセージ可視まで具体化する。

### 5. Cursor 内部ブラウザで PR を開けなかった

- **Trigger:** ユーザーが `PRをcursorの内部ブラウザーで開いてくれないか？` と指示した。
- **Missed behavior:** Simple Browser の開き方を確定せず、外部ブラウザにもフォールバックしなかった。
- **Desired behavior:** 内部ブラウザの手順が無いときは、その旨を言い、PR URL を渡す。未検証の Cursor CLI を試して止まらない。
- **Skill action:** 今回は実装しない。

### 6. マージ後に振り返りを開始しなかった

- **Trigger:** PR `#56` のマージ後、エージェントは停止し、ユーザーが `run-dev-session` を見て次工程を尋ねた。
- **Missed behavior:** フェーズ 9 はスキルに書いてあったが、マージをセッション完了として扱った。
- **Desired behavior:** マージが確認されたターンで `retrospecting-dev-session` を開始する。ユーザーが次工程を聞くのを待たない。
- **Skill action:** `run-dev-session` に完了ゲートを足し、`finishing-a-development-branch` の PR マージ確認からフェーズ 9 へ渡す。

## Skill outcomes

| Action | Path | Result |
| --- | --- | --- |
| Update | `.agents/skills/confirming-development-specifications/SKILL.md` | 各 HTTP method の成功 Body をその method の HTML 節へ置く |
| None | `migrating-drizzle-postgres` + Cursor rule | Finding 2 は `#56` で反映済み |
| Skip | `subagent-driven-development` | Finding 3 は今回実装しない |
| Update | `.agents/skills/recording-ios-e2e-evidence/SKILL.md` | 入力エラー PNG は検証メッセージが見える。Idle を入力エラーと名乗らない |
| Skip | `finishing-a-development-branch` 内部ブラウザ | Finding 5 は今回実装しない |
| Update | `.agents/skills/run-dev-session/SKILL.md` | マージ確認ターンでフェーズ 9 を開始。`retrospective.md` が無いあいだセッションを完了しない |
| Update | `.agents/skills/finishing-a-development-branch/SKILL.md` | PR マージ確認後はフェーズ 9 へ進む。マージはセッション完了ではない |
