import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { loadDatabaseConfig } from './config.js'
import { createDbClient } from './db/client.js'
import { createShutdownHandler } from './server.js'

const { pool } = createDbClient(loadDatabaseConfig(process.env))
const server = serve({ fetch: createApp().fetch, port: 3000 })
const shutdown = createShutdownHandler(server, pool)

process.once('SIGINT', () => {
  void shutdown()
})
process.once('SIGTERM', () => {
  void shutdown()
})
