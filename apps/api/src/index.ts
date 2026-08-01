import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { loadDatabaseConfig, loadObservabilityConfig } from './config.js'
import { createDbClient } from './db/client.js'
import { createLogger } from './observability/logger.js'
import { closeSentry } from './observability/sentry.js'
import { createShutdownHandler } from './server.js'

const databaseConfig = loadDatabaseConfig(process.env)
const observabilityConfig = loadObservabilityConfig(process.env)
const logger = createLogger(observabilityConfig)
const { pool } = createDbClient(databaseConfig)
const server = serve({
  fetch: createApp({ logger }).fetch,
  port: 3000,
})
const shutdown = createShutdownHandler(server, pool, { close: closeSentry })

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
