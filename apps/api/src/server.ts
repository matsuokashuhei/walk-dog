import type { Pool } from 'pg'
import { closeDbClient } from './db/client.js'

export function createShutdownHandler(
  server: { close: (callback: (error?: Error) => void) => unknown },
  pool: Pool,
): () => Promise<void> {
  return async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
    } finally {
      await closeDbClient(pool)
    }
  }
}
