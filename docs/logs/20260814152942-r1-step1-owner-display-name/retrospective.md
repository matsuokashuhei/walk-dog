# Retrospective — R1 Step 1 Owner display name

- Date: 2026-08-14
- Merged PR: https://github.com/matsuokashuhei/walk-dog/pull/53
- Merge commit: `07314a367c30df36044db9561379f8a2b6f854d4`
- Status: implemented
- Evidence: this conversation’s user instructions (open mockups, API HTML format, example contrast, syntax highlighting, AWS SSO login, LGTM merge) and skill-compliance review round 1

## Findings

### 1. HTML モックをユーザーが `open` するよう指示した

- **Trigger:** 目的承認後、エージェントは `owner-display-name-spec-mockups.html` をセッション成果物へ書いたが、ブラウザで開かなかった。
- **Missed behavior:** ユーザーがパスを指定して `open` で開くよう指示した。
- **Desired behavior:** 画面または API の HTML 契約を保存した直後、ユーザーが頼む前に `open` で開く。
- **Skill action:** `confirming-development-specifications` の製品契約提示に「保存した HTML を `open` する」を必須化する。

### 2. API 仕様を指定 HTML フォーマットで書くようユーザーが指示した

- **Trigger:** エージェントは HTTP API を `specification-review.md` の箇条書きとして提示し、HTML 仕様書は作らなかった。
- **Missed behavior:** ユーザーがエンドポイント、Request parameters（Header / Path / Query / Body）、Response（Status / Body）、Example（cURL Request と status ごとの JSON）の HTML を指定した。
- **Desired behavior:** 目的が HTTP API を含むとき、画面モックと同じセッションディレクトリへ API HTML を先に置き、その節構成で提示する。
- **Skill action:** `confirming-development-specifications` と `explaining-specifications-and-design` の WHAT 完了条件に、この HTML 節構成を必須化する。Finding 1 と同じ節で `open` も固定する。

### 3. Example の配色が読めず、ユーザーが修正を指示した

- **Trigger:** API HTML の Example コードブロックが紙面のベージュを継承し、中身が見えなかった。
- **Missed behavior:** ユーザーが配色の改善を指示した。続けて Highlight.js でハイライトできるか尋ね、独自実装なら不要、簡単なら実施と条件を付けた。
- **Desired behavior:** Example は紙面上で暗い文字として読める。CDN の Highlight.js 1 本で足りるときは bash / json をハイライトする。独自ハイライターは作らない。
- **Skill action:** Finding 2 の API HTML 節に、Example のコントラスト（暗い文字）と CDN Highlight.js（独自実装しない）を完了条件として足す。

### 4. Cognito OTP 取得の前に AWS SSO 切れへ進んだ

- **Trigger:** iOS E2E は Sign In から Verify まで進めたあと、CloudWatch OTP 取得が `walk-dog` プロファイルの期限切れで失敗した。
- **Missed behavior:** ユーザーが端末で `aws sso login --profile walk-dog` を完了してから再開を指示した。
- **Desired behavior:** OTP を CloudWatch から取る E2E は、シミュレータを Verify へ進める前に SSO セッションを確認する。期限切れならログイン手順を出して停止する。
- **Skill action:** `recording-ios-e2e-evidence` に、Cognito OTP / CloudWatch 依存の事前チェックを追加する。

### 5. PATCH の不正入力クラスと OpenAPI request schema をスキル準拠レビューが指摘した

- **Trigger:** Task 2/3 完了時点の route / OpenAPI test は空文字相当のみで、欠如・101 文字・余剰キー・不正 JSON と PATCH request schema をロックしていなかった。
- **Missed behavior:** スキル準拠レビュー round 1 が Important 2 件を返し、`1dbb32b` で修正した。
- **Desired behavior:** POST/PATCH route Task の完了前に、欠如、余剰キー、不正 JSON、境界長、400/401 の `code` / `message` / `requestId` / `retryable`、OpenAPI の required / minLength / maxLength / non-nullable を assert する。
- **Skill action:** `testing-hono-apis` の route 契約と OpenAPI 完了条件を、この不正クラス一覧と request schema 断言まで具体化する。`documenting-hono-openapi` の完了条件に同じ request schema assert を足す。

## Proposed skill paths

| Action | Path | Section intent |
| --- | --- | --- |
| Update | `.agents/skills/confirming-development-specifications/SKILL.md` | API HTML 節構成、保存直後の `open`、Example 可読性 |
| Update | `.agents/skills/explaining-specifications-and-design/SKILL.md` | WHAT の HTTP API 成果物を同じ HTML 節構成にする |
| Update | `.agents/skills/recording-ios-e2e-evidence/SKILL.md` | CloudWatch OTP 前の AWS SSO 確認 |
| Update | `.agents/skills/testing-hono-apis/SKILL.md` | 不正入力クラスと envelope / OpenAPI request schema を完了条件にする |
| Update | `.agents/skills/documenting-hono-openapi/SKILL.md` | OpenAPI test が request required / minLength / maxLength を assert する |

## Skill outcomes

| Action | Path | Result |
| --- | --- | --- |
| Update | `.agents/skills/confirming-development-specifications/SKILL.md` | API HTML 節構成、保存直後の `open`、Example 可読性と CDN Highlight.js |
| Update | `.agents/skills/explaining-specifications-and-design/SKILL.md` | WHAT の HTTP API 成果物を同じ HTML 節構成にする |
| Update | `.agents/skills/recording-ios-e2e-evidence/SKILL.md` | CloudWatch OTP 前の AWS SSO 確認 |
| Update | `.agents/skills/testing-hono-apis/SKILL.md` | 不正入力クラスと envelope / OpenAPI request schema を完了条件にする |
| Update | `.agents/skills/documenting-hono-openapi/SKILL.md` | OpenAPI test が request required / minLength / maxLength を assert する |
