import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import type { SQSClient } from '@aws-sdk/client-sqs'
import type { Pool } from 'pg'
import {
  defaultFactories,
  type ApplicationConfigs,
  type ApplicationFactories,
  type ApplicationResources,
  type ApplicationUseCases,
} from './application-factories.js'
import type { CognitoClient } from './infrastructure/cognito/client.js'
import type { DbInstance } from './infrastructure/database/client.js'
import { closeSentry, setRequestIdTag } from './infrastructure/observability/sentry.js'
import type { Logger } from './infrastructure/observability/logger.js'
import { pingPostgres, pingWorkerHealth } from './health-pings.js'
import type { App } from './shared/http/types.js'

export type {
  ApplicationConfigs,
  ApplicationFactories,
  ApplicationResources,
  ApplicationUseCases,
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
  const dynamoDbClient = factories.createDynamoDbClient(configs.dynamodb)
  const app = composeApp(factories, configs, {
    logger,
    database,
    pool,
    cognitoClient,
    sqsClient,
    dynamoDbClient,
  })

  return {
    app,
    resources: {
      pool,
      cognitoClient,
      sqsClient,
      dynamoDbClient,
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
    dynamoDbClient: DynamoDBClient
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
    dynamoDbClient: resources.dynamoDbClient,
    dynamoDbConfig: configs.dynamodb,
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
    dynamoDbClient: DynamoDBClient
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
