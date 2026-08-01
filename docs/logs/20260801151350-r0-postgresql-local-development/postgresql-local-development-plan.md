# R0 PostgreSQL and Local Docker Development Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide the R0 `owners` PostgreSQL schema, Drizzle migration runner, and a local Docker environment that starts the API after migration succeeds.

**Architecture:** `apps/api/src/db/schema` is the TypeScript source of truth. Drizzle Kit generates SQL into `apps/api/drizzle`; the generated SQL is reviewed and a dedicated node-postgres connection applies it under the `walk_dog_schema_migration` advisory lock. `apps/compose.yml` starts PostgreSQL, a one-shot migration service, and the Hono API in dependency order.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, Drizzle Kit, node-postgres (`pg`), PostgreSQL 16, Docker Compose, Node test runner, and `tsx`.

## Global Constraints

- R0 creates `owners` with `id`, `cognito_subject`, `created_at`, and `updated_at`.
- `cognito_subject` is `TEXT NOT NULL UNIQUE`.
- `id` is `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- Timestamp columns are `TIMESTAMPTZ NOT NULL DEFAULT now()`.
- The TypeScript Drizzle schema is the migration source of truth.
- Use `drizzle-kit generate`, review its SQL, then apply it; do not use `drizzle-kit push`.
- Each API process owns one `pg.Pool`; `DATABASE_POOL_MAX` defaults to 10 and shutdown closes the pool.
- Runtime migration uses the `walk_dog_schema_migration` advisory lock and releases it when the connection closes.
- `postgres` becomes healthy before `migrate` runs, and `api` starts after `migrate` exits successfully.
- Migration failure returns a failed process state with the migration version and PostgreSQL result in structured output; the API starts after a successful retry.

## Documentation Reviewed

- <https://orm.drizzle.team/docs/connect-overview>
- <https://orm.drizzle.team/docs/sql-schema-declaration>
- <https://orm.drizzle.team/docs/migrations>
- <https://orm.drizzle.team/docs/drizzle-kit-generate>
- <https://orm.drizzle.team/docs/drizzle-kit-migrate>
- <https://orm.drizzle.team/docs/drizzle-config-file>

---

### Task 1: PostgreSQL configuration and Drizzle client

**Files:**
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/db/client.ts`
- Create: `apps/api/test/config.test.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/package-lock.json`

**Interfaces:**
- `loadDatabaseConfig(env: NodeJS.ProcessEnv): { databaseUrl: string; poolMax: number }`
- `createDbClient(config: { databaseUrl: string; poolMax: number }): { db: NodePgDatabase; pool: Pool }`
- `closeDbClient(pool: Pool): Promise<void>`

- [ ] **Step 1: Write the failing configuration tests**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadDatabaseConfig } from '../src/config.js'

test('loads DATABASE_URL and defaults DATABASE_POOL_MAX to 10', () => {
  assert.deepEqual(loadDatabaseConfig({ DATABASE_URL: 'postgresql://walk:dog@localhost/walkdog' }), {
    databaseUrl: 'postgresql://walk:dog@localhost/walkdog', poolMax: 10,
  })
})

test('loads an explicit DATABASE_POOL_MAX', () => {
  assert.equal(loadDatabaseConfig({ DATABASE_URL: 'postgresql://walk:dog@localhost/walkdog', DATABASE_POOL_MAX: '4' }).poolMax, 4)
})

test('rejects a missing DATABASE_URL', () => {
  assert.throws(() => loadDatabaseConfig({}), /DATABASE_URL is required/)
})
```

- [ ] **Step 2: Verify the tests fail for the intended reason**

Run: `npm test -- --test-name-pattern='DATABASE_URL|DATABASE_POOL_MAX'`

Expected: FAIL because `src/config.ts` does not exist.

- [ ] **Step 3: Install dependencies and add scripts**

From `apps/api`, run `npm install drizzle-orm pg` and `npm install --save-dev drizzle-kit @types/pg`. Add these scripts:

```json
{
  "db:generate": "drizzle-kit generate",
  "migrate": "tsx src/db/migrate.ts",
  "test:integration": "tsx --test test/integration/**/*.test.ts"
}
```

- [ ] **Step 4: Implement the configuration and client**

Use the existing Zod dependency to require a non-empty `DATABASE_URL` and parse `DATABASE_POOL_MAX` as a positive integer with default `10`. Use `pg.Pool` and `drizzle-orm/node-postgres`; pass the pool to `drizzle()` and close it from `closeDbClient`.

- [ ] **Step 5: Run focused tests and build**

Run: `npm test -- --test-name-pattern='DATABASE_URL|DATABASE_POOL_MAX' && npm run build`

Expected: focused tests pass and TypeScript compilation succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/config.ts apps/api/src/db/client.ts apps/api/test/config.test.ts
git commit -m "feat: add postgres drizzle client"
```

### Task 2: Owners schema and generated SQL migration

**Files:**
- Create: `apps/api/src/db/schema/owners.ts`
- Create: `apps/api/src/db/schema/index.ts`
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/drizzle/` generated SQL and metadata
- Create: `apps/api/test/schema.test.ts`

**Interfaces:**
- `src/db/schema/index.ts` exports the `owners` Drizzle table.
- The generated migration creates the exact R0 columns and constraints.

- [ ] **Step 1: Write the failing schema contract test**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { owners } from '../src/db/schema/index.js'

test('owners schema exposes the R0 persistence fields', () => {
  assert.ok(owners.id)
  assert.ok(owners.cognitoSubject)
  assert.ok(owners.createdAt)
  assert.ok(owners.updatedAt)
  assert.equal(owners.id.name, 'id')
  assert.equal(owners.cognitoSubject.name, 'cognito_subject')
  assert.equal(owners.createdAt.name, 'created_at')
  assert.equal(owners.updatedAt.name, 'updated_at')
})
```

- [ ] **Step 2: Verify the schema test fails**

Run: `npm test -- --test-name-pattern='owners schema'`

Expected: FAIL because the schema module does not exist.

- [ ] **Step 3: Define the schema and Drizzle config**

Use `pgTable('owners', { uuid('id').defaultRandom().primaryKey(), text('cognito_subject').notNull().unique(), timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), timestamp('updated_at', { withTimezone: true }).defaultNow().notNull() })`. Export it from `src/db/schema/index.ts`. Configure `drizzle.config.ts` with PostgreSQL dialect, `./src/db/schema`, `./drizzle`, and the Drizzle migration journal in schema `drizzle`.

- [ ] **Step 4: Run the schema test and generate SQL**

Run:

```bash
npm test -- --test-name-pattern='owners schema'
npm run db:generate -- --name=owners
```

Expected: the schema test passes and Drizzle creates a new SQL migration under `apps/api/drizzle`.

- [ ] **Step 5: Review generated SQL**

Read the generated `migration.sql` and verify it contains `CREATE TABLE "owners"`, UUID primary key with `gen_random_uuid()`, `TEXT NOT NULL` subject, both `TIMESTAMPTZ NOT NULL DEFAULT now()` columns, and a unique constraint on `cognito_subject`. Record the generated path and SQL review result in the session transcript.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/schema apps/api/drizzle.config.ts apps/api/drizzle apps/api/test/schema.test.ts
git commit -m "feat: add owners drizzle schema"
```

### Task 3: Locked migration runner and PostgreSQL integration test

**Files:**
- Create: `apps/api/src/db/migrate.ts`
- Create: `apps/api/test/integration/owners.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- `runMigrations(config: { databaseUrl: string }): Promise<void>`
- `npm run migrate` exits nonzero when applying a migration fails.

- [ ] **Step 1: Write the failing integration test**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from 'pg'
import { loadDatabaseConfig } from '../../src/config.js'
import { runMigrations } from '../../src/db/migrate.js'

const config = loadDatabaseConfig(process.env)

test('migration creates owners and enforces subject uniqueness', async () => {
  await runMigrations({ databaseUrl: config.databaseUrl })
  const client = new Client({ connectionString: config.databaseUrl })
  await client.connect()
  try {
    await client.query('TRUNCATE owners')
    await client.query("INSERT INTO owners (cognito_subject) VALUES ('subject-1')")
    await assert.rejects(client.query("INSERT INTO owners (cognito_subject) VALUES ('subject-1')"), /unique/i)
  } finally {
    await client.query('TRUNCATE owners')
    await client.end()
  }
})
```

- [ ] **Step 2: Verify the integration test fails**

With PostgreSQL available, run `npm run test:integration`.

Expected: FAIL because `src/db/migrate.ts` does not exist.

- [ ] **Step 3: Implement the locked migration runner**

Create a dedicated `pg.Client`, connect with `DATABASE_URL`, run `pg_advisory_lock(hashtext('walk_dog_schema_migration'))`, and call `migrate(drizzle(client), { migrationsFolder })` from `drizzle-orm/node-postgres/migrator`. Read the Drizzle migration journal after the call and emit a JSON line containing applied versions. In `finally`, run the matching advisory unlock and close the client; let the original migration error reach the process.

- [ ] **Step 4: Run integration verification and build**

Run: `npm run migrate && npm run test:integration && npm run build`

Expected: migration succeeds, the integration test passes, and the build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/migrate.ts apps/api/test/integration/owners.test.ts apps/api/package.json
git commit -m "feat: add locked postgres migrations"
```

### Task 4: Compose services and local verification

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/api/.dockerignore`
- Create: `apps/.env.example`
- Create: `apps/compose.yml`
- Create: `docs/logs/20260801151350-r0-postgresql-local-development/completion-checklist.md`
- Modify: `apps/api/README.md`

**Interfaces:**
- Compose provides `postgres`, one-shot `migrate`, and `api` with dependency conditions.
- The checklist records database migration and API health verification.

- [ ] **Step 1: Verify the Compose contract**

Run `docker compose -f apps/compose.yml config` after creating the files. Verify that PostgreSQL has a healthcheck and that API depends on migration with `service_completed_successfully`.

- [ ] **Step 2: Create the image and environment template**

Create an API image that installs the lockfile dependencies, copies TypeScript source and Drizzle artifacts, and runs the package `dev` script. Define `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, and `DATABASE_POOL_MAX` in `apps/.env.example`; Compose consumes `apps/.env.local`.

- [ ] **Step 3: Create ordered Compose services**

Use this service dependency shape:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
  migrate:
    build: ./api
    command: npm run migrate
    depends_on:
      postgres:
        condition: service_healthy
  api:
    build: ./api
    command: npm run dev
    depends_on:
      migrate:
        condition: service_completed_successfully
```

Attach the shared environment file and PostgreSQL volume, and publish ports 3000 and 5432 for local verification.

- [ ] **Step 4: Verify the complete local flow**

Run:

```bash
docker compose -f apps/compose.yml up --build -d
docker compose -f apps/compose.yml ps
curl --include http://localhost:3000/health
docker compose -f apps/compose.yml logs migrate
docker compose -f apps/compose.yml down
```

Expected: `migrate` exits 0, `api` is running, `/health` returns the existing HTTP 200 JSON and `X-Request-Id`, and migration logs include the generated version.

- [ ] **Step 5: Record and document verification**

Record commands, statuses, migration version, API response, and retry command in `completion-checklist.md`. Document local setup, `npm run db:generate`, SQL review, `npm run migrate`, `npm run test:integration`, and Compose startup in `apps/api/README.md`.

- [ ] **Step 6: Run full verification and commit**

Run `npm test`, `npm run build`, and `docker compose -f apps/compose.yml config`; expect all tests, build, and Compose validation to pass. Then commit:

```bash
git add apps/api/Dockerfile apps/api/.dockerignore apps/.env.example apps/compose.yml apps/api/README.md docs/logs/20260801151350-r0-postgresql-local-development/completion-checklist.md
git commit -m "feat: add local postgres compose environment"
```

## Plan Self-Review

- Spec coverage: the plan covers the R0 `owners` table, validated settings, pool lifecycle, generated SQL review, advisory-locked migration, Compose ordering, failure state, and automated plus HTTP verification.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step remains; generated migration filenames are produced by the exact command and recorded after generation.
- Type consistency: `loadDatabaseConfig`, `createDbClient`, `closeDbClient`, and `runMigrations` signatures are reused consistently.
