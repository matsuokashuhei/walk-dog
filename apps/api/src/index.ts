import type { Pool } from 'pg'
import {
  createApp as createHonoApp,
  type AppDependencies,
  type ModuleRoute,
} from './app.js'
import { createAccessTokenVerifier as createProductionAccessTokenVerifier } from './infrastructure/cognito/access-token-verifier.js'
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
import { createDrizzleDogRepository } from './infrastructure/database/repositories/drizzle-dog-repository.js'
import { createDrizzleOwnerRepository } from './infrastructure/database/repositories/drizzle-owner-repository.js'
import { createDrizzleWalkRepository } from './infrastructure/database/repositories/drizzle-walk-repository.js'
import {
  createLogger as createProductionLogger,
  type Logger,
} from './infrastructure/observability/logger.js'
import { closeSentry, setRequestIdTag } from './infrastructure/observability/sentry.js'
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
import {
  registerDogRoutes,
  type DogRepository,
  type DogRouteDependencies,
} from './modules/dogs/index.js'
import { createCreateDog } from './modules/dogs/use-cases/create-dog.js'
import { createGetDog } from './modules/dogs/use-cases/get-dog.js'
import { createListDogs } from './modules/dogs/use-cases/list-dogs.js'
import { registerHealthRoutes } from './modules/health/index.js'
import {
  registerOwnerRoutes,
  type OwnerRepository,
  type OwnerRouteDependencies,
} from './modules/owners/index.js'
import { createGetOwner } from './modules/owners/use-cases/get-owner.js'
import { createUpdateOwnerDisplayName } from './modules/owners/use-cases/update-owner-display-name.js'
import {
  registerWalkRoutes,
  type ActiveWalkCommands,
  type WalkRepository,
  type WalkRouteDependencies,
} from './modules/walks/index.js'
import { createFinishWalk } from './modules/walks/use-cases/finish-walk.js'
import { createGetActiveWalk } from './modules/walks/use-cases/get-active-walk.js'
import { createStartWalk } from './modules/walks/use-cases/start-walk.js'
import type { AccessTokenVerifier } from './shared/http/access-token.js'
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

export type ApplicationUseCases = AuthRouteDependencies & OwnerRouteDependencies & DogRouteDependencies & WalkRouteDependencies

export type ApplicationFactories = {
  loadConfigs: (env: NodeJS.ProcessEnv) => ApplicationConfigs
  createLogger: (config: ApplicationConfigs['observability']) => Logger
  createDatabase: (config: DatabaseConfig) => { db: DbInstance; pool: Pool }
  createCognitoClient: (config: CognitoConfig) => CognitoClient
  createAuthProvider: (client: CognitoClient) => AuthProvider
  createOwnerRepository: (db: DbInstance) => OwnerRepository
  createDogRepository: (db: DbInstance) => DogRepository
  createWalkRepository: (db: DbInstance) => WalkRepository
  createActiveWalkCommands: (walks: WalkRepository) => ActiveWalkCommands
  createAccessTokenVerifier: (config: CognitoConfig) => AccessTokenVerifier
  createUseCases: (dependencies: {
    authProvider: AuthProvider
    ownerRepository: OwnerRepository
    dogRepository: DogRepository
    walkRepository: WalkRepository
    activeWalkCommands: ActiveWalkCommands
    accessTokenVerifier: AccessTokenVerifier
  }) => ApplicationUseCases
  createAuthRoutes: (dependencies: AuthRouteDependencies) => App
  createOwnerRoutes: (dependencies: OwnerRouteDependencies) => App
  createDogRoutes: (dependencies: DogRouteDependencies) => App
  createWalkRoutes: (dependencies: WalkRouteDependencies) => App
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
  createDogRepository(database) {
    return createDrizzleDogRepository(database)
  },
  createWalkRepository(database) {
    return createDrizzleWalkRepository(database)
  },
  createActiveWalkCommands(walks) {
    return walks
  },
  createAccessTokenVerifier(config) {
    return createProductionAccessTokenVerifier(config)
  },
  createUseCases({
    authProvider,
    ownerRepository,
    dogRepository,
    walkRepository,
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
      getOwner: createGetOwner(ownerRepository),
      updateOwnerDisplayName: createUpdateOwnerDisplayName(ownerRepository),
      listDogs: createListDogs(ownerRepository, dogRepository),
      createDog: createCreateDog(ownerRepository, dogRepository),
      getDog: createGetDog(ownerRepository, dogRepository),
      getActiveWalk: createGetActiveWalk(ownerRepository, walkRepository),
      startWalk: createStartWalk(ownerRepository, walkRepository),
      finishWalk: createFinishWalk(ownerRepository, walkRepository),
    }
  },
  createAuthRoutes(dependencies) {
    return registerAuthRoutes(dependencies)
  },
  createOwnerRoutes(dependencies) {
    return registerOwnerRoutes(dependencies)
  },
  createDogRoutes(dependencies) {
    return registerDogRoutes(dependencies)
  },
  createWalkRoutes(dependencies) {
    return registerWalkRoutes(dependencies)
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
  const dogRepository = factories.createDogRepository(database)
  const walkRepository = factories.createWalkRepository(database)
  const activeWalkCommands = factories.createActiveWalkCommands(walkRepository)
  const accessTokenVerifier = factories.createAccessTokenVerifier(configs.cognito)
  const useCases = factories.createUseCases({
    authProvider,
    ownerRepository,
    dogRepository,
    walkRepository,
    activeWalkCommands,
    accessTokenVerifier,
  })
  const authRoutes = factories.createAuthRoutes(useCases)
  const ownerRoutes = factories.createOwnerRoutes(useCases)
  const dogRoutes = factories.createDogRoutes(useCases)
  const walkRoutes = factories.createWalkRoutes(useCases)
  const healthRoutes = factories.createHealthRoutes()
  const app = factories.createApp(
    { logger, setRequestId: setRequestIdTag },
    [
      { path: '/', app: healthRoutes },
      { path: '/v1/auth', app: authRoutes },
      { path: '/v1/owner', app: ownerRoutes },
      { path: '/v1/dogs', app: dogRoutes },
      { path: '/v1/walks', app: walkRoutes },
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
