# Specification review

- status: ready
- Purpose: R1 Step 2 の Dog 一覧・登録と、登録時 Daily 30分 Goal Revision を API とモバイルで実装する
- Active release: R1
- next permitted action: design

## Sources

1. `docs/development/staged-development.md`
   - アクティブリリースは R1。開発焦点は散歩記録の縦切り。
   - R1 縦切り 2 は Dog 一覧・登録・選択と、登録時 Daily 30分 Goal Revision。
   - このステップの必須前提: PostgreSQL schema（Dog / Goal Revision）、Cognito（API側トークン検証）、モバイル認証状態、モバイル API クライアント。
   - Avatar と S3 は R2（Dog編集・Avatarアップロード）。Goal Revision の追加と Daily / Weekly Goal Progress は R2。
   - Walk Ready の Dog 選択、開始、記録は縦切り 3。
   - 公開インターフェースは `/v1` 配下に Dog、Goal API を段階ごとに追加する。
2. `docs/specs/external-specification.html`
   - Dogs List は `/(tabs)/dogs`。0件は Empty。登録は `/dogs/new`。Name・Gender 必須、Birthday 任意。
   - Gender は Male、Female、Unknown。Name は同一 Owner 内で一意、前後空白除去後 1〜100 文字。別 Owner 間の同名は許可する。
   - Birthday は Unknown、年、年月、年月日。API 省略時は Unknown。入力した精度を保持する。
   - Dog 登録時に Daily 30分の Goal Revision を作成する。未保存入力を破棄して戻るときは確認し、キャンセル時は入力を保持する。
   - `GET /dogs` は `{ dogs }`。`POST /dogs` は `{ name, gender, birthday?, avatarUrl? }` を受け、Dog と初期 Goal を返す。
   - `GET /dogs/:dogId` は Dog + currentGoal + goalRevisions + recentWalks。`PATCH /dogs/:dogId` と Goal 追加は Dog 編集・Goal 変更。
   - 同一 Name の再登録は `DOG_NAME_DUPLICATE` を表示し、入力を保持する（AC-DOG-01）。
   - 認証が必要な API は `Authorization: Bearer <access_token>`。Base URL は `/v1`。
3. `docs/specs/mobile-journey-wireflow.html`
   - DOG-01 `/(tabs)/dogs` は Current Dogs の一覧。Empty / Loading / Error を区別する。成功遷移は DOG-02 詳細または DOG-03 登録。
   - DOG-03 `/dogs/new` は Name、Gender、partial Birthday、independent Goals、Avatar。
   - DOG-02 `/dogs/:dogId` は profile、Goal progress、Completed Walk 履歴。
   - WALK-01 Ready が current Dogs を選択して散歩を開始する。
4. Current implementation
   - 認証済みホーム `apps/mobile/src/app/(app)/index.tsx` は「Dogs List arrives in Step 2」を表示し、Settings へ進める。
   - PostgreSQL schema は `owners` のみ。Dog / Goal Revision の table はない。
   - 認証ゲート（BearerAuth）、`GET` / `PATCH /v1/owner`、モバイル認証状態、`lib/owner-api.ts` は導入済み。

## Current release deliverables

1. `GET /v1/dogs` は Access Token で認証し、その Owner が管理する Dog と、各 Dog の現在 Goal（登録時の Daily 30分）を返す。
2. `POST /v1/dogs` は Access Token で認証し、`name` と `gender` を必須、`birthday` を任意として受け、Dog と Daily 30分の Goal Revision を同じ応答で返す。
3. `GET /v1/dogs/:dogId` は Access Token で認証し、その Owner が管理する Dog と現在 Goal を返す。
4. モバイルの認証済みホームは Dogs List を表示する。0件は Empty、取得中は Loading、再試行可能な失敗は理由と再試行を表示する。行を開くとプロフィール Detail を表示する。
5. Empty と一覧の追加操作から `/dogs/new` で登録する。登録成功後は Dogs List に戻り、新しい Dog を含めて表示する。
6. 契約テストと iOS E2E が Empty、登録成功、入力不正、名前重複、Detail、未認証、再試行可能エラーを記録する。

## Decisions

- Plan-level (confirmed): このセッションの画面は Dogs List（認証済みホーム）、Register Dog（`/dogs/new`）、プロフィールのみの Dog Detail（`/dogs/:dogId`）。Walk Ready の Dog 選択は縦切り 3。Edit、タブ（Walk / Me）、Avatar アップロード、Goal 追加、Completed Walk 履歴は後続。
- Plan-level (confirmed): R1 の公開インターフェースに `GET /v1/dogs`、`POST /v1/dogs`、`GET /v1/dogs/:dogId` を追加する。`GET /v1/dogs/:dogId` は Dog と `currentGoal` を返す。`goalRevisions` 配列と `recentWalks` は R2。`PATCH /v1/dogs/:dogId` と Goal 追加 API は Dog 編集 / Goal 変更の後続。
- Plan-level (confirmed): `POST /v1/dogs` の request body は `name` と `gender` を必須、`birthday` を任意とする。`avatarUrl` は R2 の Avatar アップロード。
- Implementation-local (proposed): Dog と Goal Revision は `dogs` module に置き、PostgreSQL へ `dogs` と `goal_revisions` を追加する。モバイルの HTTP 呼び出しは `lib/dog-api.ts` に置く。
- Implementation-local (proposed): 同一 Owner 内の Name 重複は `409` `DOG_NAME_DUPLICATE`。エラー envelope は既存 API と同じ `code` / `message` / `requestId` / `retryable`。
- Deferred: Avatar、Dog Edit、Goal Progress、Walk Ready の Participant 選択、独立 Goal の追加、Completed Walk 履歴。

## Verification conditions

- 有効な Access Token の `GET /v1/dogs` は 200 と `{ dogs }` を返す。Dog 0件のときは空配列。
- 有効な Access Token と、前後空白除去後 1〜100 文字の `name`、`male` | `female` | `unknown` の `gender` の `POST /v1/dogs` は 201 と Dog および Daily 30分 Goal Revision を返す。`birthday` 省略時の精度は `unknown`。
- Access Token 欠如または不正は 401 `UNAUTHENTICATED`。
- `name` 欠如、空、空白のみ、101 文字以上、`gender` 欠如または許容値以外、`birthday` の精度と年月日の不整合は 400 `INVALID_INPUT`。画面は入力を保持し、同じ送信で再試行する。
- 同一 Owner で同じ Name の登録は 409 `DOG_NAME_DUPLICATE`。画面は「同じ名前のDogが既に存在します。」を表示し、入力を保持する。
- 再試行可能な API 失敗は画面に理由を表示し、同じ操作で再試行する。
- 未保存入力がある状態で登録画面を戻るときは確認し、キャンセル時は入力を保持する。確定時は List へ戻る。
- 有効な Access Token と、その Owner の `dogId` の `GET /v1/dogs/:dogId` は 200 と Dog および `currentGoal` を返す。
- 別 Owner の `dogId` または存在しない `dogId` は 404 `NOT_FOUND`。画面は見つからない旨と一覧へ戻る操作を表示する。
- iOS E2E が Empty、登録画面、入力エラー、重複、成功後一覧、Detail を記録する。

## Gaps checked

- Release boundaries: Dog 縦切りが一覧・登録・プロフィール Detail と登録時 Daily 30分 Goal Revision を所有する。Walk 選択は縦切り 3。Avatar / Edit / Goal 変更 / History / Goal Progress は R2。
- Specification preconditions: Cognito トークン検証、モバイル認証状態、モバイル API クライアントは導入済み。Dog / Goal Revision の schema はこのステップ直前の必須前提で、未導入。
- Implementation evidence: 認証済みホームはプレースホルダ。`owners` schema のみ。S3 と永続送信キューはこのステップの前提ではない。
- Product contract presentation: 画面は `dog-spec-mockups.html`、API は `dog-api-spec.html`。ユーザーが契約 HTML を承認した。計画レベルの判断は `docs/development/staged-development.md` へ同期済み。

## Product contract presentation

- Screen: presented in `dog-spec-mockups.html` (HTML mockups, components, events)
- HTTP API: presented in `dog-api-spec.html` (`GET /v1/dogs`, `POST /v1/dogs`, `GET /v1/dogs/:dogId` request, response, and behavior)
