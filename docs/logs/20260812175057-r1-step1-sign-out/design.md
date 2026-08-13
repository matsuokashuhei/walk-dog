# Sign Out 設計

> WHAT → HOW → WHY

## WHAT

R1 Step 1 の Sign Out を API とモバイルで提供する。

| 提供 | 内容 |
| --- | --- |
| 認証ゲート | Cognito access token を検証し、保護 route に `principal`（Cognito subject）を渡す |
| Sign Out API | `POST /v1/auth/sign-out` → Active Walk があれば Failed → Cognito session 無効化 → `204` |
| Settings | `/settings` に法務リンクと Sign Out。Active Walk ありなら確認ダイアログ |
| Session 終了 | 成功後に Secure Store の token を削除し Sign In を表示する |

受け入れ:

- 有効 token で `204`
- 無効 / 欠落 token で `401` `UNAUTHENTICATED`
- Active Walk なし: 確認なしで Sign Out → Sign In
- Active Walk あり: 確認 → 承諾で Sign Out（Active Walk は Failed）/ キャンセルで維持
- Settings が提供する操作は法務リンクと Sign Out
- Sign Out リクエスト body の許容値は `{}` または省略

## HOW

### API

```text
BearerAuth middleware
  → principal.cognitoSubject
signOut use case
  → activeWalk.failIfPresent(owner)
  → authProvider.signOut(accessToken)
  → 204
```

| 部品 | 責務 |
| --- | --- |
| access token verifier | `aws-jwt-verify` で access token を検証。失敗は `401` `UNAUTHENTICATED` |
| `POST /v1/auth/sign-out` route | `sign-out.ts` / `signOutRoute` / `registerSignOutRoute`。保護 auth route として登録 |
| `signOut` use case | Owner 解決 → Active Walk Failed（存在時）→ Cognito sign-out |
| `AuthProvider.signOut` | Cognito `GlobalSignOut`（access token） |
| `ActiveWalkCommands.failIfPresent` | Active Walk があるとき Failed にする。現状は「存在しない」を返す実装を composition で注入し、Walk 縦切りで本実装へ差し替える |

公開 auth（sign-up / sign-in）と保護 auth（sign-out）は認証境界で分ける。root で公開 path 例外を列挙しない。

### モバイル

| 部品 | 責務 |
| --- | --- |
| `(app)/settings` | Settings 画面。法務リンク、Sign Out、loading / error |
| Active Walk 照会 | 端末または API 上の Active Walk 有無。現状は常になし。Walk 縦切りで接続 |
| 確認ダイアログ | Active Walk ありのときだけ表示 |
| Sign Out 呼び出し | Bearer access token 付き `POST /v1/auth/sign-out`。`204` は空 body を成功として扱う |
| `clearSession` | Secure Store の token 削除 → Sign In |
| 入口 | 認証済みホームから `/settings` へ遷移 |

### 検証

- API route / use case / middleware 契約テスト（`204`、`401`、入力不正）
- OpenAPI に `POST /v1/auth/sign-out` と `BearerAuth` を載せる
- iOS: Settings idle、Sign Out 成功後の Sign In。Active Walk 確認は Active Walk 接続後に証跡追加

## Official documentation reviewed

Read before Sign Out API / Zod / middleware work. Decisions follow these pages.

| Source | URL | Decision recorded |
| --- | --- | --- |
| Zod objects / `z.strictObject` | https://zod.dev/api?id=objects | Sign Out body is `z.strictObject({})`. Empty object or omitted body is the allowed input; extra keys fail validation. |
| Hono middleware | https://hono.dev/docs/guides/middleware | Path-scoped `app.use('/sign-out', …)` early-returns 401; `await next()` stays outside verify catch. |
| Hono middleware concept | https://hono.dev/docs/concepts/middleware | Registration order; handler after auth gate. |
| Hono routing | https://hono.dev/docs/api/routing | Child app routes + parent `app.route('/v1/auth', …)`; register child routes before mount. |
| Hono Context | https://hono.dev/docs/api/context | `c.set('principal')` / `c.get('requestId')` for typed Variables. |
| Hono validation | https://hono.dev/docs/guides/validation | JSON body via OpenAPI/Zod at the route; `c.req.valid('json')`. |
| Zod OpenAPI | https://hono.dev/examples/zod-openapi | `createRoute` + `security: [{ BearerAuth: [] }]` + `app.doc('/openapi.json')`. |
| Hono testing | https://hono.dev/docs/guides/testing | Route contracts use `app.request()` without a listener. |
| Node.js test runner | https://nodejs.org/api/test.html | `node --import tsx --test`. |

## WHY

- 確定仕様（確認ダイアログ + 常に Failed、`/settings`）を R1 アカウント縦切りに載せる
- Active Walk 本実装は Step 3 前提のため、Sign Out はコマンド境界だけ先に固定し、現時点は「Active Walk なし」で成立させる
- 最初の保護 API として token 検証を JIT 導入し、以降の認証済み endpoint の土台にする
