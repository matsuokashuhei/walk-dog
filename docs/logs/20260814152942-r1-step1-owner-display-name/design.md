# Owner 表示名登録 設計

> WHAT → HOW → WHY

## WHAT

R1 Step 1 の Owner 表示名登録を API とモバイルで提供する。

| 提供 | 内容 |
| --- | --- |
| Owner 取得 | `GET /v1/owner` → 現在の Owner。`displayName` は未設定時 `null` |
| 表示名登録 | `PATCH /v1/owner` `{ displayName }` → 更新後の Owner |
| 登録画面 | `/owner/display-name`。OTP 成功後およびセッション復元時に未設定なら表示する |
| 成功遷移 | 登録成功後は認証済みホーム。Settings の Sign Out はこの画面から到達できる |

受け入れ:

- 有効 token の GET / PATCH は 200 と Owner
- token 欠如または不正は 401 `UNAUTHENTICATED`
- `displayName` 欠如、空、空白のみ、101 文字以上は 400 `INVALID_INPUT`
- 前後空白除去後 1〜100 文字を保存する
- 未設定なら登録画面、設定済みならホーム
- 入力エラーと再試行可能な失敗では入力を保持し、同じ送信で再試行する
- 画面契約: `owner-display-name-spec-mockups.html`
- API 契約: `owner-display-name-api-spec.html`

## HOW

### API

```text
BearerAuth middleware
  → principal.cognitoSubject
GET  /v1/owner
  → owners.getOwner(cognitoSubject)
  → 200 Owner
PATCH /v1/owner
  → displayName を trim して 1〜100 文字
  → owners.updateDisplayName(cognitoSubject, displayName)
  → 200 Owner
```

| 部品 | 責務 |
| --- | --- |
| `owners` module | GET / PATCH の契約、use case、route。`/v1/owner` に mount |
| `OwnerRepository.resolveByCognitoSubject` | GET で現在の Owner を返す（既存の upsert） |
| `OwnerRepository.updateDisplayName` | cognitoSubject の `displayName` と `updatedAt` を更新して Owner を返す |
| BearerAuth | Sign Out と同じ access token 検証。`401 UNAUTHENTICATED` |
| Zod | PATCH body は `z.strictObject({ displayName: z.string().trim().nonempty().max(100) })` |

`owners` が Owner リソース schema を所有する。auth の認証応答は同じ Owner 形を再利用する。

### モバイル

| 部品 | 責務 |
| --- | --- |
| `lib/owner-api.ts` | `GET /v1/owner` と `PATCH /v1/owner` |
| Owner 状態 | セッションがあるとき GET で Owner を取る。復元と OTP 後で同じ照合 |
| `(app)/owner/display-name` | 登録画面。NAME-01〜05、Settings への導線 |
| `(app)/_layout` | `displayName === null` なら登録画面、設定済みならホーム。Settings は両方から到達できる |
| 送信中 | 再操作を受け付けない。失敗時は入力を残して再試行する |

### 検証

- API route / use case / repository 契約テスト（200、400、401）
- OpenAPI に `GET /v1/owner` と `PATCH /v1/owner`、`BearerAuth` を載せる
- iOS: 登録画面、入力エラー、成功後ホーム

## Official documentation reviewed

| Source | URL | Decision recorded |
| --- | --- | --- |
| Zod strings (`trim`, `nonempty`, `max`) | https://zod.dev/api?id=strings | `displayName` は `z.string().trim().nonempty().max(100)`。trim のあと 1〜100 文字。 |
| Zod objects / `z.strictObject` | https://zod.dev/api?id=objects | PATCH body は `z.strictObject({ displayName })`。追加キーは 400。 |
| Hono routing | https://hono.dev/docs/api/routing | `{ path: '/v1/owner', app: ownerRoutes }` に GET `/` と PATCH `/` を載せる。 |
| Hono middleware | https://hono.dev/docs/guides/middleware | child app で `app.use('*', authenticationMiddleware)` のあと route を登録する。 |
| Zod OpenAPI | https://hono.dev/examples/zod-openapi | `createRoute` + `security: [{ BearerAuth: [] }]`。 |
| Hono testing | https://hono.dev/docs/guides/testing | `app.request()` で契約テストする。 |
| Node.js test runner | https://nodejs.org/api/test.html | `node --import tsx --test`。 |
| Drizzle update | https://orm.drizzle.team/docs/update | `updateDisplayName` は `.update().set({ displayName }).where(...).returning()`。`updatedAt` は `$onUpdate`。 |

## WHY

- アカウント縦切りの残能力が出名登録である。`display_name` 列と BearerAuth は導入済みなので、更新 API と登録画面を足せば縦切りが閉じる。
- Avatar と `/owner/edit` は R3 の Owner編集に残す。
- GET をセッション復元の正本にし、OTP 応答の `owner` と別経路を増やさない。
