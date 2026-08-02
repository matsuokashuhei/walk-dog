---
name: migrating-drizzle-postgres
description: Generate, review, and apply Drizzle Kit PostgreSQL SQL migrations for schema changes. Use when running drizzle-kit generate or migrate, reviewing migration SQL, or configuring drizzle.config. Do not use for ad-hoc schema edits without migration, SQL CRUD, relational queries, or Pool setup alone.
---

# Migrating Drizzle Postgres

Read the current official Drizzle Kit migration docs before generating or applying migrations. Dialect is PostgreSQL only. Follow the project migration sequence exactly.

## Required documentation review

1. Open <https://orm.drizzle.team/docs/pg/migrations> and identify the migration workflow.
2. Read the matching docs before implementing:
   - Kit overview: <https://orm.drizzle.team/docs/pg/kit-overview>
   - Generate SQL: <https://orm.drizzle.team/docs/pg/drizzle-kit-generate>
   - Apply SQL: <https://orm.drizzle.team/docs/pg/drizzle-kit-migrate>
   - Config file: <https://orm.drizzle.team/docs/pg/drizzle-config-file>
3. Record the documentation URLs read and the migration decision in the active session log, design, or pull request description.

## Project defaults

- Source of truth is the TypeScript Drizzle schema.
- Production and shared development flow is codebase-first: `generate` → review SQL → `migrate`.
- Do not use `drizzle-kit push` for the project migration flow.
- Runtime `npm run migrate` uses a dedicated PostgreSQL session, acquires advisory lock `walk_dog_schema_migration`, applies Drizzle migrations, logs applied versions, and releases the lock when the session ends.
- Schema definition edits belong with `$defining-drizzle-schemas` before generation.

## Required sequence

Run this sequence for a database shape change. Do not skip review.

1. Update the TypeScript schema (`$defining-drizzle-schemas`).
2. Run `drizzle-kit generate` with the project `drizzle.config`.
3. Rename the generated migration SQL file from the random Drizzle name to a meaningful name (e.g. `0000_create_owners.sql`). Update the `tag` field in `drizzle/meta/_journal.json` to match.
4. Review the generated SQL migration for the intended shape change.
5. Apply with the project migrate command (`npm run migrate` or the documented Kit migrate entrypoint).
6. Verify the applied migration version and dependent checks.

## Migration naming

- Drizzle Kit generates random migration names (e.g. `0000_flaky_the_stranger.sql`). Rename them to describe the change (e.g. `0000_create_owners.sql`) and update the matching `tag` in `_journal.json`.

## Undeployed tables

- When a table from a pending migration has not been deployed to any environment, do not create a new migration for changes. Instead:
  1. Delete the pending migration SQL file and its snapshot in `drizzle/meta/`.
  2. Delete the corresponding `_journal.json` entry.
  3. Run `drizzle-kit generate` to produce a single migration with the current schema.
  4. Rename the file and update `_journal.json` as described above.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | The Kit command and official Drizzle docs read. |
| Design | Schema diff intent, migration folder, and apply environment. |
| Implementation | Generated SQL plus config or migrate-script changes only when required. |
| Verification | Reviewed SQL, successful migrate, and typecheck or tests that depend on the new shape. |

## Common decisions

| Request | Read before implementation | Record |
| --- | --- | --- |
| Schema shape change | Migrations fundamentals and generate | Generated migration path and SQL summary |
| Apply pending migrations | Migrate docs and project migrate command | Applied versions and lock behavior |
| drizzle.config change | Config file docs | dialect, schema path, out path |
| Rename ambiguity during generate | Generate docs | Rename answers recorded in the session log |
| Bypass SQL files with push | Do not use for project flow | N/A |

## Completion check

Before reporting a migration change complete, provide the documentation reviewed, the generated or applied migration artifacts, the SQL review outcome, and the verification results.
