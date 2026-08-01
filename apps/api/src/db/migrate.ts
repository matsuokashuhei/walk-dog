import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Client } from 'pg'
import { loadDatabaseConfig } from '../config.js'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))
const migrationJournalUrl = new URL('../../drizzle/meta/_journal.json', import.meta.url)
const advisoryLockSql = "SELECT pg_advisory_lock(hashtext('walk_dog_schema_migration'))"
const advisoryUnlockSql = "SELECT pg_advisory_unlock(hashtext('walk_dog_schema_migration'))"

type MigrationJournal = {
  entries: Array<{ tag: string; when: number }>
}

type MigrationClient = {
  connect: () => Promise<unknown>
  query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>
  end: () => Promise<void>
}

type MigrationDependencies = {
  createClient: (databaseUrl: string) => MigrationClient
  applyMigrations: (client: MigrationClient) => Promise<void>
  writeOutput: (line: string) => void
}

type MigrationPlan = {
  tag: string
  when: number
  statements: string[]
}

const defaultDependencies: MigrationDependencies = {
  createClient: (databaseUrl) => new Client({ connectionString: databaseUrl }),
  applyMigrations: async (client) => {
    await migrate(drizzle(client as unknown as Client), { migrationsFolder })
  },
  writeOutput: (line) => { console.log(line) },
}

async function loadMigrationPlan(): Promise<MigrationPlan[]> {
  const journal = JSON.parse(await readFile(migrationJournalUrl, 'utf8')) as MigrationJournal

  return Promise.all(journal.entries.map(async (entry) => ({
    ...entry,
    statements: (await readFile(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url), 'utf8'))
      .split('--> statement-breakpoint'),
  })))
}

async function findPendingVersions(client: MigrationClient, plan: MigrationPlan[]): Promise<string[]> {
  const tableResult = await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') AS migration_table")
  if (tableResult.rows[0]?.migration_table == null) {
    return plan.map((migration) => migration.tag)
  }

  const latestResult = await client.query(
    'SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1',
  )
  const latestVersion = Number(latestResult.rows[0]?.created_at ?? 0)
  return plan.filter((migration) => migration.when > latestVersion).map((migration) => migration.tag)
}

function errorRecord(error: unknown): Record<string, unknown> | undefined {
  return typeof error === 'object' && error !== null ? error as Record<string, unknown> : undefined
}

function findErrorQuery(error: unknown): string | undefined {
  const record = errorRecord(error)
  if (typeof record?.query === 'string') {
    return record.query.trim()
  }

  return record?.cause === undefined ? undefined : findErrorQuery(record.cause)
}

function failingMigrationVersion(
  error: unknown,
  plan: MigrationPlan[],
  pendingVersions: string[],
): string | null {
  const query = findErrorQuery(error)
  const matchedMigration = query === undefined
    ? undefined
    : plan.find((migration) => migration.statements.some((statement) => statement.trim() === query))

  return matchedMigration?.tag ?? (pendingVersions.length === 1 ? pendingVersions[0]! : null)
}

function postgresResult(error: unknown): Record<string, unknown> {
  const outer = errorRecord(error)
  const source = errorRecord(outer?.cause) ?? outer ?? {}
  const result: Record<string, unknown> = {}

  for (const field of [
    'name',
    'message',
    'severity',
    'code',
    'detail',
    'hint',
    'position',
    'where',
    'schema',
    'table',
    'column',
    'constraint',
  ]) {
    if (source[field] !== undefined) {
      result[field] = source[field]
    }
  }

  return result
}

export async function runMigrations(
  config: { databaseUrl: string },
  dependencies: MigrationDependencies = defaultDependencies,
): Promise<void> {
  const client = dependencies.createClient(config.databaseUrl)
  let plan: MigrationPlan[] = []
  let pendingVersions: string[] = []
  let originalError: unknown

  try {
    plan = await loadMigrationPlan()
    pendingVersions = plan.map((migration) => migration.tag)
    await client.connect()
    await client.query(advisoryLockSql)
    pendingVersions = await findPendingVersions(client, plan)
    await dependencies.applyMigrations(client)

    dependencies.writeOutput(JSON.stringify({ appliedVersions: plan.map((migration) => migration.tag) }))
  } catch (error) {
    originalError = error
    dependencies.writeOutput(JSON.stringify({
      event: 'migration_failed',
      migrationVersion: failingMigrationVersion(error, plan, pendingVersions),
      pendingVersions,
      postgresResult: postgresResult(error),
    }))
    throw error
  } finally {
    try {
      await client.query(advisoryUnlockSql)
    } catch (error) {
      if (originalError === undefined) {
        throw error
      }
    } finally {
      try {
        await client.end()
      } catch (error) {
        if (originalError === undefined) {
          throw error
        }
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runMigrations(loadDatabaseConfig(process.env))
}
