import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import type { DatabaseConfig } from '../config.js'
import * as schema from '../schema/owner.js'

export type DbInstance = NodePgDatabase<typeof schema>

export function createDbClient(config: DatabaseConfig): {
  db: DbInstance
  pool: Pool
} {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    max: config.poolMax,
  })

  return { db: drizzle({ client: pool, schema }), pool }
}

export async function closeDbClient(pool: Pool): Promise<void> {
  await pool.end()
}
