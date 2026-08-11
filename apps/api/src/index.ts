import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createCognitoClient } from './infrastructure/cognito/client.js'
import { createCognitoAuthProvider } from './infrastructure/cognito/cognito-auth-provider.js'
import { createDbClient } from './infrastructure/database/client.js'
import { loadCognitoConfig, loadDatabaseConfig, loadObservabilityConfig } from './infrastructure/config/index.js'
import { createLogger } from './infrastructure/observability/logger.js'
import { closeSentry, setRequestIdTag } from './infrastructure/observability/sentry.js'
import { createStartSignIn } from './modules/auth/use-cases/start-sign-in.js'
import { createStartSignUp } from './modules/auth/use-cases/start-sign-up.js'
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
    const authProvider = createCognitoAuthProvider(cognito)
    const startSignUp = createStartSignUp(authProvider)
    const startSignIn = createStartSignIn(authProvider)
    registerSignUpRoute(application, startSignUp)
    registerSignUpVerifyRoute(application, db, cognito)
    registerSignInRoute(application, startSignIn)
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
