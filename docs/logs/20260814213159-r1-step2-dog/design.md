# Dog 一覧・登録・プロフィール 設計

> WHAT → HOW → WHY

## WHAT

R1 Step 2 の Dog 一覧、登録、プロフィール Detail と、登録時 Daily 30分 Goal Revision を API とモバイルで提供する。

| 提供 | 内容 |
| --- | --- |
| Dog 一覧 | `GET /v1/dogs` → その Owner の Dog と各 `currentGoal`。0件は空配列 |
| Dog 登録 | `POST /v1/dogs` `{ name, gender, birthday? }` → Dog と Daily 30分 Goal Revision |
| プロフィール | `GET /v1/dogs/:dogId` → その Owner の Dog と `currentGoal` |
| 一覧画面 | 認証済みホーム。Empty / Loading / Error / 行一覧。追加と Settings |
| 登録画面 | `/dogs/new`。Name・Gender 必須、Birthday 任意。成功後は一覧 |
| Detail 画面 | `/dogs/:dogId`。名前、Gender、Birthday、Daily 30分 Goal |

受け入れ:

- 有効 token の GET 一覧は 200 と `{ requestId, dogs }`
- 有効 token の POST は 201 と Dog + `currentGoal`（`period: daily`, `minutes: 30`）
- 有効 token とその Owner の GET Detail は 200 と Dog + `currentGoal`
- token 欠如または不正は 401 `UNAUTHENTICATED`
- `name` 欠如、空、空白のみ、101 文字以上、`gender` 欠如または許容値以外、`birthday` 不正は 400 `INVALID_INPUT`
- 同一 Owner の Name 重複は 409 `DOG_NAME_DUPLICATE`、メッセージ「同じ名前のDogが既に存在します。」
- 別 Owner または存在しない `dogId` は 404 `NOT_FOUND`
- `name` は前後空白除去後 1〜100 文字。`gender` は `male` / `female` / `unknown`。`birthday` 省略時の精度は `unknown`
- 未保存入力の戻るは確認し、キャンセル時は入力を保持する
- 画面契約: `dog-spec-mockups.html`
- API 契約: `dog-api-spec.html`

## HOW

### API

```text
BearerAuth middleware
  → principal.cognitoSubject
GET  /v1/dogs
  → OwnerRepository.resolveByCognitoSubject
  → dogs.listByOwner(ownerId)
  → 200 { requestId, dogs }
POST /v1/dogs
  → name を trim して 1〜100 文字、gender と birthday を検証
  → OwnerRepository.resolveByCognitoSubject
  → dogs.createWithDailyGoal(ownerId, { name, gender, birthday })
  → 201 Dog + currentGoal
GET  /v1/dogs/:dogId
  → OwnerRepository.resolveByCognitoSubject
  → dogs.getByOwnerAndId(ownerId, dogId)
  → 200 Dog + currentGoal  /  404 NOT_FOUND
```

| 部品 | 責務 |
| --- | --- |
| `dogs` module | GET/POST 一覧・登録と GET Detail の契約、use case、route。`/v1/dogs` に mount |
| `DogRepository.listByOwner` | Owner の Dog と、各 Dog の `effectiveTo` が空の Goal Revision を返す |
| `DogRepository.createWithDailyGoal` | Dog と Daily 30分 Goal Revision を同一 transaction で挿入する。Name 重複は機能 error |
| `DogRepository.getByOwnerAndId` | その Owner の Dog と currentGoal。無ければ not found |
| BearerAuth | Owner と同じ access token 検証。`401 UNAUTHENTICATED` |
| `OwnerRepository.resolveByCognitoSubject` | cognitoSubject から Owner を解決する（既存） |
| Zod | POST body は `z.strictObject({ name, gender, birthday })`。`birthday` は `precision` による discriminated union。省略時は `{ precision: "unknown" }` |

`dogs` が Dog と currentGoal の応答 schema を所有する。Goal 追加 API は R2。

PostgreSQL:

| Table | 一意性・参照 |
| --- | --- |
| `dogs` | `dog_id` PK。`owner_id` は `owners.owner_id` を参照。`(owner_id, name)` 一意 |
| `goal_revisions` | `goal_revision_id` PK。`dog_id` は `dogs.dog_id` を参照。登録時 `period=daily`, `minutes=30`, `effective_to` は空 |

`birthday` は JSON（`precision` と入力した年月日）。`gender` は `male` / `female` / `unknown`。

Name 重複は PostgreSQL の unique 違反を repository が機能 error へ変換し、route が 409 にする。

### モバイル

| 部品 | 責務 |
| --- | --- |
| `lib/dog-api.ts` | `GET /v1/dogs`、`POST /v1/dogs`、`GET /v1/dogs/:dogId` |
| `(app)/index` | Dogs List。DOG-01 Empty / Loading / List / Error。Settings への導線 |
| `(app)/dogs/new` | 登録画面。DOG-03 Idle〜Discard。成功後は一覧 |
| `(app)/dogs/[dogId]` | プロフィール。DOG-02 Profile / Loading / Not found / Error |
| `(app)/_layout` | 表示名ゲートのあと List / 登録 / Detail / Settings を積む |
| 送信中 | 再操作を受け付けない。失敗時は入力を残して再試行する |

静的 `/dogs/new` を動的 `/dogs/[dogId]` より先にマッチさせる。

### 検証

- schema / repository: 同一 Owner の Name 一意、別 Owner の同名、登録時 Daily 30分 Revision
- route / use case: 200、201、400、401、404、409。OpenAPI の required / minLength / maxLength / enum
- iOS: Empty、登録、入力エラー、重複、成功後一覧、Detail

## WHY

Goal Revision はこの縦切りでは登録の副作用としてだけ存在する。`dogs` モジュールが同一 transaction で書くと、一覧と Detail が currentGoal を同じ読み方で返せる。goals モジュールは Goal 追加が公開契約になる R2 で切り出す。

## Official documentation reviewed

| Source | URL | Decision recorded |
| --- | --- | --- |
| Drizzle table declaration | https://orm.drizzle.team/docs/sql-schema-declaration | `dogs` と `goal_revisions` を PostgreSQL `pgTable` で定義する。 |
| Drizzle column types | https://orm.drizzle.team/docs/column-types/pg | `birthday` は `jsonb`。`gender` と Goal `period` は enum。 |
| Drizzle indexes / unique | https://orm.drizzle.team/docs/indexes-constraints | `(owner_id, name)` を unique。`dog_id` は `owners` / `dogs` を参照する。 |
| Drizzle insert / transactions | https://orm.drizzle.team/docs/insert | `createWithDailyGoal` は `database.transaction` で Dog と Revision を挿入する。 |
| Drizzle Kit generate | https://orm.drizzle.team/docs/kit-overview | schema 変更後に `drizzle-kit generate --name=create_dogs_and_goal_revisions`。 |
| Zod strings / enums / objects | https://zod.dev/api | `name` は `trim().nonempty().max(100)`。`gender` は enum。POST は `strictObject`。 |
| Hono routing | https://hono.dev/docs/api/routing | `{ path: '/v1/dogs', app: dogRoutes }` に GET `/`、POST `/`、GET `/:dogId`。 |
| Hono middleware | https://hono.dev/docs/guides/middleware | child app で authentication のあと route を登録する。 |
| Zod OpenAPI | https://hono.dev/examples/zod-openapi | `createRoute` + `security: [{ BearerAuth: [] }]`。 |
| Expo Router routes | https://docs.expo.dev/router/basics/core-concepts/ | `(app)/index`、`(app)/dogs/new`、`(app)/dogs/[dogId]`。 |
| Node.js test runner | https://nodejs.org/api/test.html | `node --import tsx --test`。 |
