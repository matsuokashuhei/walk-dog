---
name: connecting-drizzle-postgres
description: Create and configure the Drizzle PostgreSQL client with node-postgres Pool, connection settings, and shutdown. Use when wiring POSTGRES_* credentials, DATABASE_POOL_MAX, pg.Pool, drizzle(), or connection lifecycle. Do not use for table schema definitions, SQL CRUD, relational queries, or migration generation alone.
---

# Connecting Drizzle Postgres

Read the current official Drizzle PostgreSQL connection docs before changing database client setup. Dialect is PostgreSQL only.

## Required documentation review

1. Open <https://orm.drizzle.team/docs/connect-overview> before changing connection code.
2. Read the matching docs before implementing:
   - PostgreSQL driver connection: <https://orm.drizzle.team/docs/get-started-postgresql>
   - Get-started connection patterns when bootstrapping: <https://orm.drizzle.team/docs/get-started/postgresql-new> or <https://orm.drizzle.team/docs/get-started/postgresql-existing>
3. Record the documentation URLs read and the connection decision in the active session log, design, or pull request description.

## Project defaults

- Create one `pg.Pool` per process (API or worker) and pass it to Drizzle.
- Use validated env for `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`, `POSTGRES_PORT`, and `DATABASE_POOL_MAX` (default 10).
- Pass discrete Pool options (`host`, `port`, `user`, `password`, `database`, `max`); do not store a separate `DATABASE_URL` env var.
- For drizzle-kit, derive `dbCredentials.url` from the same `POSTGRES_*` values when needed.
- On shutdown, close the Pool so connections return to PostgreSQL.
- Pass schema modules into `drizzle()` when relational queries need `db.query`.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The driver, connection capability, and official Drizzle docs read. |
| Design | Pool ownership, env keys, schema import for `db.query`, and shutdown order. |
| Implementation | Focused client factory and lifecycle changes that follow the reviewed documentation. |
| Verification | Typecheck and a connection-backed health or smoke check when available. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| First Drizzle client | Connect overview and PostgreSQL get-started | Driver package, Pool creation site, drizzle() call |
| Pool sizing | Connect docs and project env contract | `DATABASE_POOL_MAX` and process ownership |
| Schema-aware client | Connect docs and relations query docs | Schema modules passed to drizzle() |
| Shutdown / draining | Project process lifecycle | Pool close order relative to HTTP or worker stop |

## Completion check

Before reporting a connection change complete, provide the documentation reviewed, the client lifecycle changed, and the verification results.
