# Specification review

- status: ready
- Purpose: R1 Step 1 の Owner 表示名登録を API とモバイルで実装する
- Active release: R1
- next permitted action: crit

## Sources

1. `docs/development/staged-development.md`
   - アクティブリリースは R1。アカウント縦切りは Sign Up、Sign In、OTP確認、Owner表示名登録、Sign Outを提供する。
   - 未設定の認証済み Owner は `/owner/display-name` で登録し、成功後に認証済みホームへ進む。
   - `GET /v1/owner` と `PATCH /v1/owner` を R1 公開インターフェースとする。
   - アカウント縦切りの前提: PostgreSQL schema（owners・表示名）、Cognito API側トークン検証、モバイル認証状態、モバイル API クライアント。
   - R3 は Owner編集（Avatar を含む）を提供する。本セッションの後続リリース参照。
2. `docs/specs/external-specification.html`
   - `GET /owner` は Owner を返す。`PATCH /owner` は `{ displayName }` を受け、Owner を返す。
   - `displayName` は前後空白除去後、1〜100文字。認証直後は `null` を許可し、Owner画面の継続利用には設定を要求する。
   - Owner リソースは `ownerId`、`displayName`、`avatarUrl`、`createdAt`、`updatedAt` を持つ。
   - 認証が必要な API は `Authorization: Bearer <access_token>`。Base URL は `/v1`。
3. `docs/specs/mobile-journey-wireflow.html`
   - AUTH-03 成功後は認証済みシェルへ進む。
   - ME-02 `/owner/edit` は表示名と Avatar の編集で、R3 の Owner編集に属する。
4. Session product contracts
   - `docs/logs/20260814152942-r1-step1-owner-display-name/owner-display-name-spec-mockups.html`
   - `docs/logs/20260814152942-r1-step1-owner-display-name/owner-display-name-api-spec.html`
5. Current implementation
   - `apps/api/src/infrastructure/database/schema/owner.ts` の `display_name` 列。
   - `OwnerRepository.resolveByCognitoSubject` は Owner を解決し、新規時 `displayName: null` で作成する。
   - 認証確認 API は `owner.displayName` を返す。
   - 認証ゲート（BearerAuth）と Settings Sign Out は導入済み。

## Current release deliverables

1. `GET /v1/owner` は Access Token で認証し、現在の Owner を返す。
2. `PATCH /v1/owner` は Access Token で認証し、`displayName` を受けて Owner を返す。
3. モバイルは OTP 成功後およびセッション復元時に `displayName` を照合し、未設定なら `/owner/display-name` で登録する。
4. 登録成功後は認証済みホームへ進む。この画面から Settings の Sign Out へ進める。
5. 契約テストと iOS E2E が成功、入力不正、未認証、再試行可能エラー、登録後ホームを記録する。

## Decisions

- Plan-level (confirmed): R1 の公開インターフェースに `GET /v1/owner` と `PATCH /v1/owner` を追加する。`PATCH` の request body は `displayName` を必須とする。
- Plan-level (confirmed): `displayName` が未設定の認証済み Owner は `/owner/display-name` で登録する。登録成功後に認証済みホームへ進む。Settings の Sign Out はこの画面から到達できる。
- Implementation-local (proposed): Owner 機能は `owners` module に置き、既存の `OwnerRepository` へ更新能力を追加する。モバイルの HTTP 呼び出しは `lib/owner-api.ts` に置く。
- Deferred release decision: Avatar と `/owner/edit` は R3 の Owner編集。

## Verification conditions

- 有効な Access Token の `GET /v1/owner` は 200 と Owner を返す。`displayName` は未設定時 `null`、設定後は保存した値。
- 有効な Access Token と 1〜100 文字の `displayName` の `PATCH /v1/owner` は 200 と更新後 Owner を返す。
- Access Token 欠如または不正は 401 `UNAUTHENTICATED`。
- 前後空白のみ、空文字、101 文字以上、または `displayName` 欠如は 400 `INVALID_INPUT`。画面は入力を保持し、同じ送信で再試行する。
- 再試行可能な API 失敗は画面に理由を表示し、同じ送信で再試行する。
- OTP 成功後に `displayName` が未設定なら登録画面を表示する。設定済みならホームを表示する。
- セッション復元時は `GET /v1/owner` で照合し、未設定なら登録画面を表示する。
- iOS E2E が登録画面、入力エラー、成功後ホームを記録する。

## Gaps checked

- Release boundaries: アカウント縦切りが Owner表示名登録を所有する。Dog / Walk / Avatar / Owner編集は後続。
- Specification preconditions: owners schema、Cognito トークン検証、モバイル認証状態、モバイル API クライアントは導入済み。永続送信キュー、位置情報、S3 はこのステップの前提ではない。
- Implementation evidence: `display_name` 列、認証応答の `displayName`、BearerAuth、Settings Sign Out がある。更新 repository、Owner route、登録画面はこれから追加する。
- Plan table: アカウント縦切りの PostgreSQL schema / migration は owners・表示名が必須で、列は導入済み。本セッションは更新 API と登録画面を追加する。
- Product contract presentation: 画面は `owner-display-name-spec-mockups.html`、API は `owner-display-name-api-spec.html`。ユーザーが API HTML を LGTM した。

## Product contract presentation

- Screen: presented in `owner-display-name-spec-mockups.html` (HTML mockups, components, events)
- HTTP API: presented in `owner-display-name-api-spec.html` (`GET /v1/owner`, `PATCH /v1/owner` request, response, and behavior)
