# R0 PostgreSQL and Local Docker Development Design

## Purpose

R0は、Hono APIがローカルPostgreSQLへ接続できる開発基盤と、PostgreSQLのhealth状態に連動したDocker Compose起動を提供する。

## Components and Data Flow

- `apps/api/src/config.ts`は`DATABASE_URL`と`DATABASE_POOL_MAX`を検証する。
- `apps/api/src/db/client.ts`はプロセスごとに1つの`pg.Pool`を作成し、Drizzle clientへ渡す。プロセス終了時はPoolを閉じる。
- `apps/api/drizzle.config.ts`はPostgreSQL dialect、migration出力先、`DATABASE_URL`を定義する。
- `apps/api/package.json`の`migrate` scriptは、schema追加後にDrizzle Kitの`migrate` commandでSQL migrationを適用する。
- `apps/compose.yml`は`postgres`と`api`を起動する。PostgreSQLのhealthcheck完了後にAPIを開始する。
- `apps/.env.example`はローカルPostgreSQL接続値を提供する。

## Commands

| Command | Result |
| --- | --- |
| `npm run db:generate` | 追加したDrizzle schemaからSQL migrationを生成する。生成SQLをレビューしてから適用する。 |
| `npm run migrate` | `DATABASE_URL`のPostgreSQLへ未適用SQL migrationを適用する。 |
| `docker compose -f apps/compose.yml up --build` | PostgreSQLがhealthyになった後にAPIを起動する。 |
| `curl --include http://localhost:3000/health` | APIのhealth状態と`X-Request-Id`を返す。 |

## States and Verification

- PostgreSQLは`pg_isready`のhealthcheckが成功した状態を返す。
- APIはPostgreSQLがhealthyになった後に起動し、`GET /health`へHTTP 200と`{ "status": "ok" }`を返す。
- `migrate`はSQL migrationを適用できない場合に失敗状態を返す。開発者はmigrationを更新して再実行する。

## Sources

- `docs/development/staged-development.md`
- `docs/logs/20260726141518-decide-and-execute-development/transcript.md`
- <https://orm.drizzle.team/docs/connect-overview>
- <https://orm.drizzle.team/docs/migrations>
- <https://orm.drizzle.team/docs/drizzle-kit-generate>
- <https://orm.drizzle.team/docs/drizzle-kit-migrate>
- <https://orm.drizzle.team/docs/drizzle-config-file>
