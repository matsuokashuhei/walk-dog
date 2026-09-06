import type { Pool } from 'pg'

export async function pingPostgres(pool: Pool): Promise<void> {
  await pool.query('select 1')
}

export async function pingWorkerHealth(workerHealthUrl: string): Promise<void> {
  const response = await fetch(workerHealthUrl)
  if (!response.ok) {
    throw new Error('worker health unavailable')
  }
}
