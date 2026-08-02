import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../schema/owner.js'

export type DbInstance = NodePgDatabase<typeof schema>

export function createDbClient(config: { databaseUrl: string; poolMax: number }): {
  db: DbInstance
  pool: Pool
} {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.poolMax,
  })

  return { db: drizzle({ client: pool, schema }), pool }
}

export async function closeDbClient(pool: Pool): Promise<void> {
  await pool.end()
}
