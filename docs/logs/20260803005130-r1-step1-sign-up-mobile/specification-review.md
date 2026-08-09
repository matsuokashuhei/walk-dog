# Specification review

- status: ready
- Purpose: R1 Step 1 Sign Up の Mobile 実装（API client、認証状態、Sign Up / Verify 画面）
- Active release: R1
- next permitted action: design

## Sources

1. `docs/development/staged-development.md`
   - 進捗状況: R1 進行中
   - 承認済みの判断: 開発焦点は R1; 未完了 R0 は縦切り直前に実装
   - R1 縦切りと未完了 R0 前提 表「1. アカウント」: モバイル認証状態 = 必須、モバイル API クライアント = 必須
   - R1 提供能力: Sign Up、Sign In、OTP確認、Owner表示名登録、Sign Out（本セッションは Sign Up Mobile に限定）
2. `docs/specs/external-specification.html`
   - 01.2 画面マップ: `/sign-up`, `/verify`
   - 01.3 認証ジャーニー Sign Up: Email入力 → OTP要求成功後 `/verify` → OTP確認成功後 Owner作成・認証済みへ遷移
   - 02.1 Client boundary: Base URL `/v1`、認証付き API は Bearer access token
   - 02.2 認証API: `POST /auth/sign-up` `{ email }` → `{ username, session, codeDelivery }`; 確認は username / session / code
   - 02.7 状態・エラー契約: 失敗時のメッセージと再試行操作を画面が返す
3. `docs/logs/20260802200405-r1-step1-sign-up/transcript.md`
   - マージ済み: PR #29 owners schema + Cognito client、PR #30 sign-up + verify API
   - 未完了継続情報: PR3 Mobile API client + Auth state、PR4 Mobile Sign Up + Verify screens
4. Implementation evidence
   - `apps/api/src/routes/auth.ts`: `POST /v1/auth/sign-up`, `POST /v1/auth/verify`
   - `apps/api/src/auth/cognito.ts`: Cognito signUp / confirmSignUp / initiateAuth
   - `apps/api/src/schema/owner.ts` + `apps/api/drizzle/0000_create_owners.sql`: owners テーブル導入済み
   - `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/index.tsx`: Expo Router 骨格のみ。auth / API client 未導入
   - `apps/mobile/package.json`: `expo-secure-store` 未依存

## Confirmed user decisions

1. 本セッションの提供範囲は Sign Up Mobile のみ。Sign In / Owner 表示名 / Sign Out は含めない。
2. 認証成功後の遷移先は認証済みシェル（暫定ホーム）。Dogs List 本実装は R1 Step 2 以降。
3. API パスは実装済みの `POST /v1/auth/sign-up` と `POST /v1/auth/verify` を正とする。仕様 HTML の `/auth/sign-up/verify` 表記差はこのセッションでは扱わない。

## Current-release deliverables (this purpose)

1. モバイル API client が `/v1` 向けに JSON リクエストを送り、成功レスポンスと `{ code, message, requestId, retryable }` エラーを返す。
2. モバイル認証状態が access / id / refresh token を Secure Store に保存・復元し、認証状態に応じて未認証シェルと認証済みシェルを分岐する。
3. Sign Up 画面が email を受け付け、`POST /v1/auth/sign-up` 成功後に username / session / codeDelivery を Verify へ渡して遷移する。
4. Verify 画面が OTP を受け付け、`POST /v1/auth/verify` 成功後にトークンを保存し、認証済み画面（暫定ホーム）へ遷移する。
5. Sign Up / Verify の各画面が Loading、入力フォーム、Error（メッセージ + 再試行）を表示する。

## Source map

| Deliverable | Source |
| --- | --- |
| Mobile API client（`/v1`、JSON、共通エラー） | staged-development R1前提表「モバイル API クライアント」; external-spec 02.1; 継続情報 PR3 |
| 認証状態（token 保存・復元・画面分岐） | staged-development R1前提表「モバイル認証状態」; external-spec 01.3 / 02.1; 継続情報 PR3 |
| Sign Up email → OTP 要求 → Verify | external-spec 01.3; API `POST /v1/auth/sign-up`; 継続情報 PR4 |
| Verify OTP → token 保存 → 認証済み暫定ホーム | external-spec 01.3; API `POST /v1/auth/verify`; ユーザー確認 #2 |
| Loading / Error / Retry | external-spec 02.7; 継続情報 PR4 画面状態 |

## Decision classifications

- Plan-level: なし（既存の R1 Step 1 前提と Sign Up 能力の実装。ユーザー確認済み）
- Implementation-local: API client と AuthProvider のファイル配置、画面ルート構成、Secure Store キー設計（design で確定）
- Deferred release decision: Sign In、Owner 表示名登録、Sign Out（R1 Step 1 残能力、別セッション）; Dogs List 本実装（R1 Step 2）; 仕様 HTML の verify パス表記差
- Outside the staged plan: なし

## Verification conditions

- Sign Up 成功: email 入力 → OTP 要求成功 → Verify へ遷移し、username / session を保持する。
- Verify 成功: 有効 OTP → トークン保存 → 認証済み暫定ホームを表示する。
- エラー: API が返す message を表示し、再試行操作を提供する。
- 起動時: 保存済みトークンがある場合は認証済みシェル、ない場合は未認証シェルを表示する。

## Gaps checked

- Release boundaries: 本目的は R1 Step 1 Sign Up Mobile。R2/R3 と R1 Step 2+ は含めない（ユーザー確認済み）。
- Specification preconditions: Sign Up は公開 API + モバイル認証状態 + API client。永続送信キュー、位置情報、S3/SQS はアカウント縦切りの前提ではない。
- Delivered claims with paths: owners schema / Cognito client / sign-up+verify API は implementation evidence で確認済み。Mobile auth / API client は未導入。
- Plan-table cells for Step 1: PostgreSQL schema 必須（導入済み）、モバイル認証状態・API client は本セッションで実装。
- API path discrepancy: 実装パスを正とし、仕様 HTML 更新は deferred（ユーザー確認済み）。

## Confirmation status

sources agree; deliverables referenced; open questions confirmed by user → `ready`
