import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { loadDatabaseConfig, loadCognitoConfig, loadObservabilityConfig } from './config.js'
import { createDbClient } from './db/client.js'
import { createLogger } from './observability/logger.js'
import { closeSentry, setRequestIdTag } from './observability/sentry.js'
import { createCognitoClient } from './auth/cognito.js'
import { registerAuthRoutes } from './routes/auth.js'
import { createShutdownHandler } from './server.js'

const databaseConfig = loadDatabaseConfig(process.env)
const cognitoConfig = loadCognitoConfig(process.env)
const observabilityConfig = loadObservabilityConfig(process.env)
const logger = createLogger(observabilityConfig)
const { db, pool } = createDbClient(databaseConfig)
const app = createApp(
  { logger, setRequestId: setRequestIdTag },
  (application) => { registerAuthRoutes(application, db, createCognitoClient(cognitoConfig)) },
)
const server = serve({ fetch: app.fetch, port: 3000 })
const shutdown = createShutdownHandler(server, pool, { close: closeSentry })

process.once('SIGINT', () => {
  void shutdown()
})
process.once('SIGTERM', () => {
  void shutdown()
})
