import type { Pool } from 'pg'
import { closeDbClient } from './db/client.js'
import type { SentryBridge } from './observability/sentry.js'

export function createShutdownHandler(
  server: { close: (callback: (error?: Error) => void) => unknown },
  pool: Pool,
  sentry: Pick<SentryBridge, 'close'> = { close: async () => undefined },
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
      await sentry.close()
    }
  }
}
