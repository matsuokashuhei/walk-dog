# R0 PostgreSQL and Local Docker Development Design

## Purpose

R0は、認証済みCognito principalを内部Ownerへ一意に対応付けるPostgreSQL schema、Drizzle migration、ローカルDocker開発環境を提供する。

## Data Model

R0のmigrationは`owners`を作成する。

| Column | PostgreSQL type | Constraint |
| --- | --- | --- |
| `id` | `UUID` | Primary key. `gen_random_uuid()`で値を生成する。 |
| `cognito_subject` | `TEXT` | Required and unique. Cognito principalのsubjectを保持する。 |
| `created_at` | `TIMESTAMPTZ` | Required. 作成時刻を保持する。 |
| `updated_at` | `TIMESTAMPTZ` | Required. 更新時刻を保持する。 |

```sql
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_subject TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Components and Data Flow

- `apps/api/src/db/schema/owners.ts`は`owners`のDrizzle schemaを定義する。
- `apps/api/src/config.ts`は`DATABASE_URL`と`DATABASE_POOL_MAX`を検証し、APIへ接続設定を提供する。
- `apps/api/src/db/client.ts`はプロセスごとに1つの`pg.Pool`を作成し、Drizzle clientへ渡す。プロセス終了時はPoolを閉じる。
- `apps/api/drizzle.config.ts`はPostgreSQL dialect、`src/db/schema`、`drizzle/`、`DATABASE_URL`を定義する。
- `apps/api/package.json`の`migrate` scriptはDrizzle Kitの`migrate` commandで未適用SQL migrationを適用する。
- `apps/api/drizzle/`はDrizzle Kitが生成したSQL migrationとschema snapshotを保持する。
- `apps/compose.yml`は`postgres`、`migrate`、`api`を起動する。`postgres`のhealthcheck完了後に`migrate`がmigrationを適用し、`migrate`成功後に`api`が開始する。
- `apps/.env.example`はローカルPostgreSQL接続値を提供し、`apps/.env.local`は開発環境の接続値を提供する。

## Commands

| Command | Result |
| --- | --- |
| `npm run db:generate` | Drizzle schemaからSQL migrationを生成する。生成SQLをレビューしてから適用する。 |
| `npm run migrate` | Drizzle Kitで未適用SQL migrationを順に適用する。 |
| `npm run test:integration` | `owners`テーブルと`cognito_subject`一意制約を確認する。 |
| `docker compose -f apps/compose.yml up --build` | migration完了後にAPIを起動する。 |

## States and Verification

- `migrate`は未適用SQL migrationを適用し、成功状態を返す。
- `api`は`migrate`の成功状態を前提に開始し、`GET /health`へHTTP 200と`{ "status": "ok" }`を返す。
- `migrate`はSQL migrationを適用できない場合に失敗状態を返す。開発者はmigrationを更新して再実行する。
- 統合テストはmigration適用後に`owners`の作成と、同じ`cognito_subject`の2件目の登録が一意制約の結果を返すことを確認する。

## Sources

- `docs/development/staged-development.md`
- `docs/logs/20260726141518-decide-and-execute-development/transcript.md`の4-3「R0 migrationに含めるschema」
- `docs/specs/external-specification.html`の「ER図」と「エンティティ一覧と項目」
- <https://orm.drizzle.team/docs/connect-overview>
- <https://orm.drizzle.team/docs/sql-schema-declaration>
- <https://orm.drizzle.team/docs/migrations>
- <https://orm.drizzle.team/docs/drizzle-kit-generate>
- <https://orm.drizzle.team/docs/drizzle-kit-migrate>
- <https://orm.drizzle.team/docs/drizzle-config-file>
