# Retrospective — R1 Step 5 Finish

- Date: 2026-09-06
- Merged PR: https://github.com/matsuokashuhei/walk-dog/pull/93
- Merge commit: `c53afa71c1a513de487b1352ce38cdef6942a6f5`
- Status: implemented
- Evidence: session transcript, product-contract correction (API lede), Codex iOS E2E handoff, status updates, user redirects on labels / create-vs-merge, CI lint before merge

## Findings

Trigger と Desired は今回の事例。Skill action は別セッションでも使える規則として提案する。

### 1. API 概要にエンコーディング詳細を書いた

- **Trigger:** ユーザーが Finish API の概要から Base URL / ISO 8601 UTC / camelCase を外した。「概要にこれらの説明は不要。なぜならこれらは詳細だ」。
- **Missed behavior:** 契約提示のリードに、能力ではなく転送・表記の詳細を置いた。
- **Desired behavior:** API / 画面契約の概要は提供機能だけにする。Base URL、日時表記、JSON の casing は詳細節に置く。
- **Skill action:** `confirming-development-specifications` — 契約提示の概要は能力のみ。エンコーディング詳細は method 節側へ。

### 2. 相手が知らないラベルを説明なしで使った

- **Trigger:** 進捗報告で「A/B/C」と書き、ユーザーが「A/B/Cってなに？相手が知らないことを言う時は、その説明もいれろ」と訂正した。
- **Missed behavior:** セッション内だけで通じるシナリオ記号を定義せずに使った。
- **Desired behavior:** セッション固有のラベル・略語は初出で一文定義する。
- **Skill action:** `AGENTS.md` — 相手が知らないラベル・略語は初出で定義する、を文書または開発セッション節へ追加する。

### 3. 必須 CI が赤のままマージ手順に入った

- **Trigger:** ユーザーがマージを依頼した時点で `check / lint` が失敗していた。修正コミットを後から載せた。
- **Missed behavior:** マージ実行の前に必須チェックが緑かを確認し、赤なら先に直す、という順序を守らなかった。
- **Desired behavior:** マージ前に必須 checks を確認する。赤なら原因を直し push して緑を待ってからマージする。
- **Skill action:** `publishing-pull-requests` — マージ実行前に必須 CI が緑であることを確認する。

### 4. 既存 PR があるのに「create a PR」経路のように振る舞った

- **Trigger:** マージ承認をスキップしたあとユーザーが「sorry, create a pr」と言い、既存の #93 を更新する必要があった。
- **Missed behavior:** 既に open な PR がある状態で、更新と新規作成の区別をはっきり言わなかった。
- **Desired behavior:** 同じブランチに open PR があるときは「既存 PR を更新する」と明言し、新規作成しない。
- **Skill action:** Finding 3 と同じ `publishing-pull-requests` — open PR があるときは update、create と言わない。

### 5. Codex 実行の E2E を親が未確認のまま進みうる

- **Trigger:** ユーザーが「テスト仕様を考え、実行を Codex に依頼し、その後おまえはその結果を確認しろ」と指示した。SSO 待ちや途中報告では結果確認が後回しになりうる。
- **Missed behavior:** 委任先の完了宣言だけで足りると扱い、必須 PNG とレポートを親が目視・突合する義務をスキルに固定していなかった。
- **Desired behavior:** 別エージェントがシミュレータを動かした場合も、親が必須状態の PNG と `e2e-report.md` を契約どおり確認してから合格とする。
- **Skill action:** `recording-ios-e2e-evidence` — 委任実行でも親が証跡を確認するまで合格にしない。

### 6. E2E 概要を PR description に載せることがワークフローに無かった

- **Trigger:** ユーザーがマージ済み PR の description に E2E 結果概要を画像付きで書くよう求め、続けて既存スキルを肥大化させず PR 用スキルを作れと指示した。
- **Missed behavior:** 証跡をセッションディレクトリに残すだけで、PR description への概要掲載を独立スキルにしていなかった。既存スキルへ追記して肥大化させた。
- **Desired behavior:** PR の作成・更新・description・マージ確認は専用スキルに置く。iOS E2E 証跡があるときは必須状態ごとの概要と埋め込み画像を description に載せる。
- **Skill action:** `publishing-pull-requests` を新設。`recording-ios-e2e-evidence` / `finishing-a-development-branch` には短い委任だけ残す。

### 7. 画面契約セッションで iOS E2E を必須にしていなかった

- **Trigger:** ユーザーが「E2Eテストを必須で行うことをワークフローにいれてほしい」と確認し、範囲は「モバイル／画面契約を含むセッションだけ」と選んだ。
- **Missed behavior:** 証跡の載せ方だけを書き、公開前ゲートにしていなかった。
- **Desired behavior:** 画面契約を含むセッションは、iOS E2E 証跡が揃うまで公開しない。
- **Skill action:** `run-dev-session` のゲートと公開フェーズ、`publishing-pull-requests` の作成・マージ条件。

## Skill outcomes

| Action | Path | Result |
| --- | --- | --- |
| Update | `.agents/skills/confirming-development-specifications/SKILL.md` | implemented |
| Update | `AGENTS.md` | implemented |
| Update | `.agents/skills/finishing-a-development-branch/SKILL.md` | implemented（PR 手順は委任） |
| Update | `.agents/skills/recording-ios-e2e-evidence/SKILL.md` | implemented（親確認 + PR へ委任） |
| Update | `.agents/skills/run-dev-session/SKILL.md` | implemented（公開フェーズで PR スキルを指名） |
| Create | `.agents/skills/publishing-pull-requests/SKILL.md` | implemented |

ユーザーが全提案を承認した。E2E 概要の PR 掲載は `publishing-pull-requests` に切り出した。画面契約を含むセッションでは公開前の iOS E2E を必須ゲートにした。公開は PR #94。
