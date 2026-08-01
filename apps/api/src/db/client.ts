import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export function createDbClient(config: { databaseUrl: string; poolMax: number }): {
  db: NodePgDatabase
  pool: Pool
} {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.poolMax,
  })

  return { db: drizzle({ client: pool }), pool }
}

export async function closeDbClient(pool: Pool): Promise<void> {
  await pool.end()
}
