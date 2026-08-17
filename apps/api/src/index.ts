import { SQSClient } from '@aws-sdk/client-sqs'
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
  loadSqsConfig,
  loadWorkerHealthConfig,
  type DatabaseConfig,
  type SqsConfig,
  type WorkerHealthConfig,
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
import { createSqsClient as createProductionSqsClient } from './infrastructure/sqs/client.js'
import { createEnqueueTrackPoint } from './infrastructure/sqs/enqueue-track-point.js'
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
import {
  createCheckHealth,
  registerHealthRoutes,
  type CheckHealth,
  type HealthRouteDependencies,
} from './modules/health/index.js'
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
  type TrackPointQueue,
  type WalkRepository,
  type WalkRouteDependencies,
} from './modules/walks/index.js'
import { createAcceptTrackPoint } from './modules/walks/use-cases/accept-track-point.js'
import { createDeleteWalk } from './modules/walks/use-cases/delete-walk.js'
import { createFinishWalk } from './modules/walks/use-cases/finish-walk.js'
import { createGetActiveWalk } from './modules/walks/use-cases/get-active-walk.js'
import { createStartWalk } from './modules/walks/use-cases/start-walk.js'
import type { AccessTokenVerifier } from './shared/http/access-token.js'
import type { App } from './shared/http/types.js'

export type ApplicationConfigs = {
  database: DatabaseConfig
  cognito: CognitoConfig
  sqs: SqsConfig
  workerHealth: WorkerHealthConfig
  observability: {
    environment: string
    release: string
    sentryDsn: string | undefined
  }
}

export type ApplicationResources = {
  pool: Pool
  cognitoClient: CognitoClient
  sqsClient: SQSClient
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
  createSqsClient: (config: SqsConfig) => SQSClient
  createTrackPointQueue: (client: SQSClient, config: SqsConfig) => TrackPointQueue
  createAccessTokenVerifier: (config: CognitoConfig) => AccessTokenVerifier
  createUseCases: (dependencies: {
    authProvider: AuthProvider
    ownerRepository: OwnerRepository
    dogRepository: DogRepository
    walkRepository: WalkRepository
    activeWalkCommands: ActiveWalkCommands
    trackPointQueue: TrackPointQueue
    accessTokenVerifier: AccessTokenVerifier
  }) => ApplicationUseCases
  createAuthRoutes: (dependencies: AuthRouteDependencies) => App
  createOwnerRoutes: (dependencies: OwnerRouteDependencies) => App
  createDogRoutes: (dependencies: DogRouteDependencies) => App
  createWalkRoutes: (dependencies: WalkRouteDependencies) => App
  createCheckHealth: (dependencies: {
    pingPostgres: () => Promise<void>
    pingWorker: () => Promise<void>
  }) => CheckHealth
  createHealthRoutes: (dependencies: HealthRouteDependencies) => App
  createApp: (dependencies: AppDependencies, routes: ModuleRoute[]) => App
}

const defaultFactories: ApplicationFactories = {
  loadConfigs(env) {
    return {
      database: loadDatabaseConfig(env),
      cognito: loadCognitoConfig(env),
      sqs: loadSqsConfig(env),
      workerHealth: loadWorkerHealthConfig(env),
      observability: loadObservabilityConfig(env),
    }
  },
  createLogger: createProductionLogger,
  createDatabase: createDbClient,
  createCognitoClient: createProductionCognitoClient,
  createAuthProvider: createCognitoAuthProvider,
  createOwnerRepository: createDrizzleOwnerRepository,
  createDogRepository: createDrizzleDogRepository,
  createWalkRepository: createDrizzleWalkRepository,
  createActiveWalkCommands: (walks) => walks,
  createSqsClient: createProductionSqsClient,
  createTrackPointQueue: createEnqueueTrackPoint,
  createAccessTokenVerifier: createProductionAccessTokenVerifier,
  createUseCases({
    authProvider,
    ownerRepository,
    dogRepository,
    walkRepository,
    activeWalkCommands,
    trackPointQueue,
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
      deleteWalk: createDeleteWalk(ownerRepository, walkRepository),
      acceptTrackPoint: createAcceptTrackPoint(ownerRepository, walkRepository, trackPointQueue),
    }
  },
  createAuthRoutes: registerAuthRoutes,
  createOwnerRoutes: registerOwnerRoutes,
  createDogRoutes: registerDogRoutes,
  createWalkRoutes: registerWalkRoutes,
  createCheckHealth,
  createHealthRoutes: registerHealthRoutes,
  createApp: createHonoApp,
}

async function pingPostgres(pool: Pool): Promise<void> {
  await pool.query('select 1')
}

async function pingWorkerHealth(workerHealthUrl: string): Promise<void> {
  const response = await fetch(workerHealthUrl)
  if (!response.ok) {
    throw new Error('worker health unavailable')
  }
}

export function createApplication(
  env: NodeJS.ProcessEnv,
  factories: ApplicationFactories = defaultFactories,
): { app: App; resources: ApplicationResources } {
  const configs = factories.loadConfigs(env)
  const logger = factories.createLogger(configs.observability)
  const { db: database, pool } = factories.createDatabase(configs.database)
  const cognitoClient = factories.createCognitoClient(configs.cognito)
  const sqsClient = factories.createSqsClient(configs.sqs)
  const app = composeApp(factories, configs, {
    logger,
    database,
    pool,
    cognitoClient,
    sqsClient,
  })

  return {
    app,
    resources: {
      pool,
      cognitoClient,
      sqsClient,
      closeSentry,
    },
  }
}

function composeUseCases(
  factories: ApplicationFactories,
  configs: ApplicationConfigs,
  resources: {
    database: DbInstance
    cognitoClient: CognitoClient
    sqsClient: SQSClient
  },
): ApplicationUseCases {
  const authProvider = factories.createAuthProvider(resources.cognitoClient)
  const ownerRepository = factories.createOwnerRepository(resources.database)
  const dogRepository = factories.createDogRepository(resources.database)
  const walkRepository = factories.createWalkRepository(resources.database)
  const activeWalkCommands = factories.createActiveWalkCommands(walkRepository)
  const trackPointQueue = factories.createTrackPointQueue(resources.sqsClient, configs.sqs)
  const accessTokenVerifier = factories.createAccessTokenVerifier(configs.cognito)
  return factories.createUseCases({
    authProvider,
    ownerRepository,
    dogRepository,
    walkRepository,
    activeWalkCommands,
    trackPointQueue,
    accessTokenVerifier,
  })
}

function composeApp(
  factories: ApplicationFactories,
  configs: ApplicationConfigs,
  resources: {
    logger: Logger
    database: DbInstance
    pool: Pool
    cognitoClient: CognitoClient
    sqsClient: SQSClient
  },
): App {
  const useCases = composeUseCases(factories, configs, resources)
  const authRoutes = factories.createAuthRoutes(useCases)
  const ownerRoutes = factories.createOwnerRoutes(useCases)
  const dogRoutes = factories.createDogRoutes(useCases)
  const walkRoutes = factories.createWalkRoutes(useCases)
  const checkHealth = factories.createCheckHealth({
    pingPostgres: () => pingPostgres(resources.pool),
    pingWorker: () => pingWorkerHealth(configs.workerHealth.workerHealthUrl),
  })
  return factories.createApp(
    { logger: resources.logger, setRequestId: setRequestIdTag },
    [
      { path: '/', app: factories.createHealthRoutes({ checkHealth }) },
      { path: '/v1/auth', app: authRoutes },
      { path: '/v1/owner', app: ownerRoutes },
      { path: '/v1/dogs', app: dogRoutes },
      { path: '/v1/walks', app: walkRoutes },
    ],
  )
}
