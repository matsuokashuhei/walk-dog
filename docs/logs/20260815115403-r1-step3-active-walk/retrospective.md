# Retrospective — R1 Step 3 Active Walk

- Date: 2026-08-16
- Merged PR: https://github.com/matsuokashuhei/walk-dog/pull/58
- Merge commit: `82c3430cc3acdf2a8ef7b289c7dfc1df425767ad`
- Status: skipped
- Evidence: session transcript (mockup gap, DELETE redirect, DELETE-only E2E, SSO resume, `walk_command_keys` question, skill-action specificity), PR #58 (no review threads)

## Findings

Trigger と Desired は今回の事例。Skill action は別セッションでも使える規則。

### 1. 画面状態と公開操作が契約で分かれていた

- **Trigger:** Failed が破棄と書いて、Active Walk の照会は recording のままだった。
- **Missed behavior:** 表示する状態だけを実装し、それを成立させる操作を契約に置かなかった。
- **Desired behavior:** 表示する状態は、それを成立させる操作と返すデータと同じ契約に書く。
- **Skill action:** `confirming-development-specifications` — 表示する状態は、成立させる操作と返すデータと一緒に定義する。

### 2. 完了根拠がテスト成功だった

- **Trigger:** 承認済み画面契約の実装漏れをユーザーが尋ねた。
- **Missed behavior:** テスト成功を完了根拠にし、承認済みの観測可能な状態を突き合わせなかった。
- **Desired behavior:** 完了前に、承認済み契約の観測可能な状態を確認する。
- **Skill action:** `verification-before-completion` — 完了の根拠は承認済み契約の観測可能な状態であり、テスト成功だけではない。Finding 1 は契約の書き方、こちらは完了ゲート。別スキルにする。

### 3. 画面証跡が公開操作の結果と対応していなかった

- **Trigger:** 新しい呼び出し経路の E2E をユーザーが求めた。既存の失敗画面証跡は、その操作が無い時点のものだった。
- **Missed behavior:** 単体テストと文書は足し、その経路の画面証跡を公開操作の結果と対応付けなかった。
- **Desired behavior:** 画面証跡は、その状態を成立させた公開操作の結果と同じ成果物で対応付ける。
- **Skill action:** `recording-ios-e2e-evidence` — 画面証跡は、それを成立させた公開操作の結果と対応付ける。

### 4. 停止後の完了合図から再開する手順が無かった

- **Trigger:** 前提確認に失敗してユーザー操作を依頼したあと、完了の合図が返った。
- **Missed behavior:** 停止まで書いて、完了合図のあとに同じ前提確認から再開することを書いていなかった。
- **Desired behavior:** 完了の合図があれば、同じ前提確認を再実行して再開する。
- **Skill action:** Finding 3 と同じ `recording-ios-e2e-evidence` — 前提確認の失敗でユーザー操作を待ったあと、完了の合図があれば同じ確認から再開する。

### 5. 追加した表が公開契約のどれを保持するか書いていなかった

- **Trigger:** 計画上のエンティティ一覧に無い表の用途をユーザーが尋ねた。
- **Missed behavior:** 表を足したが、公開契約のどのデータと制約を保持するかを設計に書かなかった。
- **Desired behavior:** 追加する表は、公開契約のどのデータと制約を保持するかを設計に書く。
- **Skill action:** `defining-drizzle-schemas` — 追加する表は、公開契約のどのデータと制約を保持するかを設計に書く。

### 6. 仕様が method を書いていない操作に新しい verb を置いた

- **Trigger:** 既存リソースを対象とする操作に、仕様に無い POST path を提案し、ユーザーが標準 method を選んだ。
- **Missed behavior:** 仕様が method を書いていないのに、操作名を path にした。
- **Desired behavior:** 仕様が method を書いていないとき、対象と操作の意味に合う標準 method を使う。
- **Skill action:** `routing-hono-apis` — 仕様が method を書いていないとき、対象と操作の意味に合う標準 method を使う。

### 7. Skill action が今回の固有名詞になっていた

- **Trigger:** ユーザーが、足すことが具体的すぎると指摘した。
- **Missed behavior:** Skill action に今回の画面、endpoint、コマンドを書いた。
- **Desired behavior:** Skill action は再利用できる規則。事例は Trigger に残す。
- **Skill action:** `retrospecting-dev-session` — Skill action は再利用できる規則であり、今回の固有名詞を書かない。

## Skill outcomes

| Action | Path | Result |
| --- | --- | --- |
| Skip | `.agents/skills/confirming-development-specifications/SKILL.md` | 今回は実装しない |
| Skip | `.agents/skills/verification-before-completion/SKILL.md` | 今回は実装しない |
| Skip | `.agents/skills/recording-ios-e2e-evidence/SKILL.md` | 今回は実装しない |
| Skip | `.agents/skills/defining-drizzle-schemas/SKILL.md` | 今回は実装しない |
| Skip | `.agents/skills/routing-hono-apis/SKILL.md` | 今回は実装しない |
| Skip | `.agents/skills/retrospecting-dev-session/SKILL.md` | 今回は実装しない |
