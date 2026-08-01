# R0 PostgreSQL and Local Docker Development Design

## Purpose

R0は、認証済みCognito principalを内部Ownerへ一意に対応付けるPostgreSQL schema、Drizzle migration、ローカルDocker開発環境を提供する。

## Release Context

- R0は`owners`を業務データとして提供する。
- R1はOwner表示名、Dog、Goal Revision、Walk、Participant、Eventの業務データを提供する。
- R3はOwner Avatar参照を提供する。

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

R1のmigrationは`display_name`を提供する。初回認証直後は未設定を受け付け、設定値は前後空白を除いた1〜100文字を受け付ける。R3のmigrationは、APIがS3へ保存したOwner Avatarの参照として`avatar_url`を提供する。

## Components and Data Flow

- `apps/api/src/db/schema/owners.ts`は`owners`のDrizzle schemaを定義する。
- `apps/api/src/db/client.ts`は`DATABASE_URL`から`pg` PoolとDrizzle clientを作成する。
- `apps/api/src/db/migrate.ts`はPostgreSQL advisory lockを取得し、Drizzleの未適用migrationを順に適用する。
- `apps/api/drizzle.config.ts`はmigration生成の入力と出力を定義する。
- `apps/api/drizzle/`は生成されたSQL migrationと適用履歴を保持する。
- `apps/compose.yml`は`postgres`、`migrate`、`api`を起動する。`postgres`のhealthcheck完了後に`migrate`がmigrationを適用し、`migrate`成功後に`api`が開始する。
- `.env.example`はローカルPostgreSQL接続値を提供し、`.env.local`は開発環境の接続値を提供する。

## Commands

| Command | Result |
| --- | --- |
| `npm run db:generate` | Drizzle schemaからSQL migrationを生成する。 |
| `npm run db:migrate` | advisory lockのもとで未適用migrationを順に適用する。 |
| `npm run test:integration` | `owners`テーブルと`cognito_subject`一意制約を確認する。 |
| `docker compose -f apps/compose.yml up --build` | migration完了後にAPIを起動する。 |

## States and Verification

- `migrate`は適用したmigration名を出力し、成功状態を返す。
- `api`は`migrate`の成功状態を前提に開始し、`GET /health`へHTTP 200と`{ "status": "ok" }`を返す。
- `migrate`は適用できないmigration名とPostgreSQLの結果を出力して失敗状態を返す。開発者はmigrationを更新して再実行する。
- 統合テストはmigration適用後に`owners`の作成と、同じ`cognito_subject`の2件目の登録が一意制約の結果を返すことを確認する。

## Sources

- `docs/development/staged-development.md`
- `docs/logs/20260726141518-decide-and-execute-development/transcript.md`の4-3「R0 migrationに含めるschema」
- `docs/specs/external-specification.html`の「ER図」と「エンティティ一覧と項目」
