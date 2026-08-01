import type { Pool } from 'pg'
import { closeDbClient } from './db/client.js'

export function createShutdownHandler(server: { close: () => unknown }, pool: Pool): () => Promise<void> {
  return async () => {
    server.close()
    await closeDbClient(pool)
  }
}
