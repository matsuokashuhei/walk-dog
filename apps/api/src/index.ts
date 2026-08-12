import type { Pool } from 'pg'
import {
  createApp as createHonoApp,
  type AppDependencies,
  type ModuleRoute,
} from './app.js'
import {
  createAccessTokenVerifier as createProductionAccessTokenVerifier,
  type AccessTokenVerifier,
} from './infrastructure/cognito/access-token-verifier.js'
import {
  createCognitoClient as createProductionCognitoClient,
  type CognitoClient,
  type CognitoConfig,
} from './infrastructure/cognito/client.js'
import { createCognitoAuthProvider } from './infrastructure/cognito/cognito-auth-provider.js'
import {
  loadCognitoConfig,
  loadDatabaseConfig,
  loadObservabilityConfig,
  type DatabaseConfig,
} from './infrastructure/config/index.js'
import {
  createDbClient,
  type DbInstance,
} from './infrastructure/database/client.js'
import { createDrizzleOwnerRepository } from './infrastructure/database/repositories/drizzle-owner-repository.js'
import {
  createLogger as createProductionLogger,
  type Logger,
} from './infrastructure/observability/logger.js'
import { closeSentry, setRequestIdTag } from './infrastructure/observability/sentry.js'
import { createAbsentActiveWalkCommands } from './infrastructure/walks/absent-active-walk-commands.js'
import {
  registerAuthRoutes,
  type AuthRouteDependencies,
} from './modules/auth/index.js'
import type { AuthProvider } from './modules/auth/provider.js'
import { createSignOut } from './modules/auth/use-cases/sign-out.js'
import { createStartSignIn } from './modules/auth/use-cases/start-sign-in.js'
import { createStartSignUp } from './modules/auth/use-cases/start-sign-up.js'
import { createVerifySignIn } from './modules/auth/use-cases/verify-sign-in.js'
import { createVerifySignUp } from './modules/auth/use-cases/verify-sign-up.js'
import { registerHealthRoutes } from './modules/health/index.js'
import type { OwnerRepository } from './modules/owners/index.js'
import type { ActiveWalkCommands } from './modules/walks/active-walk-commands.js'
import type { App } from './shared/http/types.js'

export type ApplicationConfigs = {
  database: DatabaseConfig
  cognito: CognitoConfig
  observability: {
    environment: string
    release: string
    sentryDsn: string | undefined
  }
}

export type ApplicationResources = {
  pool: Pool
  cognitoClient: CognitoClient
  closeSentry: () => Promise<void>
}

export type ApplicationFactories = {
  loadConfigs: (env: NodeJS.ProcessEnv) => ApplicationConfigs
  createLogger: (config: ApplicationConfigs['observability']) => Logger
  createDatabase: (config: DatabaseConfig) => { db: DbInstance; pool: Pool }
  createCognitoClient: (config: CognitoConfig) => CognitoClient
  createAuthProvider: (client: CognitoClient) => AuthProvider
  createOwnerRepository: (db: DbInstance) => OwnerRepository
  createActiveWalkCommands: () => ActiveWalkCommands
  createAccessTokenVerifier: (config: CognitoConfig) => AccessTokenVerifier
  createUseCases: (dependencies: {
    authProvider: AuthProvider
    ownerRepository: OwnerRepository
    activeWalkCommands: ActiveWalkCommands
    accessTokenVerifier: AccessTokenVerifier
  }) => AuthRouteDependencies
  createAuthRoutes: (dependencies: AuthRouteDependencies) => App
  createHealthRoutes: () => App
  createApp: (dependencies: AppDependencies, routes: ModuleRoute[]) => App
}

const defaultFactories: ApplicationFactories = {
  loadConfigs(env) {
    return {
      database: loadDatabaseConfig(env),
      cognito: loadCognitoConfig(env),
      observability: loadObservabilityConfig(env),
    }
  },
  createLogger(config) {
    return createProductionLogger(config)
  },
  createDatabase(config) {
    return createDbClient(config)
  },
  createCognitoClient(config) {
    return createProductionCognitoClient(config)
  },
  createAuthProvider(client) {
    return createCognitoAuthProvider(client)
  },
  createOwnerRepository(database) {
    return createDrizzleOwnerRepository(database)
  },
  createActiveWalkCommands() {
    return createAbsentActiveWalkCommands()
  },
  createAccessTokenVerifier(config) {
    return createProductionAccessTokenVerifier(config)
  },
  createUseCases({
    authProvider,
    ownerRepository,
    activeWalkCommands,
    accessTokenVerifier,
  }) {
    return {
      startSignUp: createStartSignUp(authProvider),
      verifySignUp: createVerifySignUp(authProvider, ownerRepository),
      startSignIn: createStartSignIn(authProvider),
      verifySignIn: createVerifySignIn(authProvider, ownerRepository),
      signOut: createSignOut(ownerRepository, activeWalkCommands, authProvider),
      accessTokenVerifier,
    }
  },
  createAuthRoutes(dependencies) {
    return registerAuthRoutes(dependencies)
  },
  createHealthRoutes() {
    return registerHealthRoutes()
  },
  createApp(dependencies, routes) {
    return createHonoApp(dependencies, routes)
  },
}

export function createApplication(
  env: NodeJS.ProcessEnv,
  factories: ApplicationFactories = defaultFactories,
): { app: App; resources: ApplicationResources } {
  const configs = factories.loadConfigs(env)
  const logger = factories.createLogger(configs.observability)
  const { db: database, pool } = factories.createDatabase(configs.database)
  const cognitoClient = factories.createCognitoClient(configs.cognito)
  const authProvider = factories.createAuthProvider(cognitoClient)
  const ownerRepository = factories.createOwnerRepository(database)
  const activeWalkCommands = factories.createActiveWalkCommands()
  const accessTokenVerifier = factories.createAccessTokenVerifier(configs.cognito)
  const useCases = factories.createUseCases({
    authProvider,
    ownerRepository,
    activeWalkCommands,
    accessTokenVerifier,
  })
  const authRoutes = factories.createAuthRoutes(useCases)
  const healthRoutes = factories.createHealthRoutes()
  const app = factories.createApp(
    { logger, setRequestId: setRequestIdTag },
    [
      { path: '/', app: healthRoutes },
      { path: '/v1/auth', app: authRoutes },
    ],
  )

  return {
    app,
    resources: {
      pool,
      cognitoClient,
      closeSentry,
    },
  }
}
