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
  entries: Array<{ tag: string }>
}

export async function runMigrations(config: { databaseUrl: string }): Promise<void> {
  const client = new Client({ connectionString: config.databaseUrl })
  let originalError: unknown

  try {
    await client.connect()
    await client.query(advisoryLockSql)
    await migrate(drizzle(client), { migrationsFolder })

    const journal = JSON.parse(await readFile(migrationJournalUrl, 'utf8')) as MigrationJournal
    console.log(JSON.stringify({ appliedVersions: journal.entries.map((entry) => entry.tag) }))
  } catch (error) {
    originalError = error
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
