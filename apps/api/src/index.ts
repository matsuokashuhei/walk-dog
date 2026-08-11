import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createCognitoClient } from './auth/cognito.js'
import { createDbClient } from './db/client.js'
import { loadCognitoConfig, loadDatabaseConfig, loadObservabilityConfig } from './infrastructure/config/index.js'
import { createLogger } from './infrastructure/observability/logger.js'
import { closeSentry, setRequestIdTag } from './infrastructure/observability/sentry.js'
import { registerSignInRoute, registerSignInVerifyRoute, registerSignUpRoute, registerSignUpVerifyRoute } from './routes/index.js'
import { createShutdownHandler } from './server.js'

const databaseConfig = loadDatabaseConfig(process.env)
const cognitoConfig = loadCognitoConfig(process.env)
const observabilityConfig = loadObservabilityConfig(process.env)
const logger = createLogger(observabilityConfig)
const { db, pool } = createDbClient(databaseConfig)
const app = createApp(
  { logger, setRequestId: setRequestIdTag },
  (application) => {
    const cognito = createCognitoClient(cognitoConfig)
    registerSignUpRoute(application, cognito)
    registerSignUpVerifyRoute(application, db, cognito)
    registerSignInRoute(application, cognito)
    registerSignInVerifyRoute(application, db, cognito)
  },
)
const server = serve({ fetch: app.fetch, port: 3000 })
const shutdown = createShutdownHandler(server, pool, { close: closeSentry })

process.once('SIGINT', () => {
  void shutdown()
})
process.once('SIGTERM', () => {
  void shutdown()
})
