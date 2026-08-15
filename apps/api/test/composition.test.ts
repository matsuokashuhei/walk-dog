import assert from 'node:assert/strict'
import test from 'node:test'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppDependencies, ModuleRoute } from '../src/app.js'
import type { CognitoClient, CognitoConfig } from '../src/infrastructure/cognito/client.js'
import type { DatabaseConfig } from '../src/infrastructure/config/index.js'
import type { DbInstance } from '../src/infrastructure/database/client.js'
import type { Logger } from '../src/infrastructure/observability/logger.js'
import type { AuthRouteDependencies } from '../src/modules/auth/index.js'
import type { AccessTokenVerifier } from '../src/shared/http/access-token.js'
import type { AuthProvider } from '../src/modules/auth/provider.js'
import type {
  CreateDog,
  DogRepository,
  DogRouteDependencies,
  GetDog,
  ListDogs,
} from '../src/modules/dogs/index.js'
import type {
  GetOwner,
  OwnerRepository,
  OwnerRouteDependencies,
  UpdateOwnerDisplayName,
} from '../src/modules/owners/index.js'
import type {
  ActiveWalkCommands,
  FinishWalk,
  GetActiveWalk,
  StartWalk,
  WalkRepository,
  WalkRouteDependencies,
} from '../src/modules/walks/index.js'
import type { AppVariables } from '../src/shared/http/types.js'
import {
  createApplication,
  type ApplicationFactories,
} from '../src/index.js'
import { runNode, sanitizedEnv } from './support/subprocess.js'

const env: NodeJS.ProcessEnv = {
  POSTGRES_USER: 'user',
  POSTGRES_PASSWORD: 'password',
  POSTGRES_DB: 'db',
  POSTGRES_HOST: '127.0.0.1',
  POSTGRES_PORT: '5432',
  AWS_REGION: 'ap-northeast-1',
  COGNITO_USER_POOL_ID: 'pool',
  COGNITO_CLIENT_ID: 'client',
  ENVIRONMENT: 'test',
  RELEASE: 'test-release',
}

test('importing index.ts does not construct production resources', async () => {
  const result = await runNode(
    [
      '--import',
      'tsx',
      '-e',
      `
        import { createApplication } from './src/index.ts'
        console.log('IMPORT_OK')
        console.log(typeof createApplication)
      `,
    ],
    sanitizedEnv(),
  )

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /IMPORT_OK/)
  assert.match(result.stdout, /function/)
})

test('createApplication shares one database and Cognito client through the object graph', () => {
  const calls: string[] = []
  const database = { db: { kind: 'db' } as unknown as DbInstance, pool: { kind: 'pool' } }
  const cognitoClient = { kind: 'cognito', destroy() {} } as unknown as CognitoClient
  const authProvider = { kind: 'auth-provider' } as unknown as AuthProvider
  const ownerRepository = { kind: 'owner-repository' } as unknown as OwnerRepository
  const dogRepository = { kind: 'dog-repository' } as unknown as DogRepository
  const walkRepository = { kind: 'walk-repository' } as unknown as WalkRepository
  const activeWalkCommands = { kind: 'active-walk-commands' } as unknown as ActiveWalkCommands
  const accessTokenVerifier = { kind: 'access-token-verifier' } as unknown as AccessTokenVerifier
  const getOwner: GetOwner = async () => {
    throw new Error('unused')
  }
  const updateOwnerDisplayName: UpdateOwnerDisplayName = async () => {
    throw new Error('unused')
  }
  const listDogs: ListDogs = async () => {
    throw new Error('unused')
  }
  const createDog: CreateDog = async () => {
    throw new Error('unused')
  }
  const getDog: GetDog = async () => {
    throw new Error('unused')
  }
  const getActiveWalk: GetActiveWalk = async () => {
    throw new Error('unused')
  }
  const startWalk: StartWalk = async () => {
    throw new Error('unused')
  }
  const finishWalk: FinishWalk = async () => {
    throw new Error('unused')
  }
  const useCases = {
    startSignUp: async () => {
      throw new Error('unused')
    },
    verifySignUp: async () => {
      throw new Error('unused')
    },
    startSignIn: async () => {
      throw new Error('unused')
    },
    verifySignIn: async () => {
      throw new Error('unused')
    },
    signOut: async () => {
      throw new Error('unused')
    },
    accessTokenVerifier,
    getOwner,
    updateOwnerDisplayName,
    listDogs,
    createDog,
    getDog,
    getActiveWalk,
    startWalk,
    finishWalk,
  } satisfies AuthRouteDependencies & OwnerRouteDependencies & DogRouteDependencies & WalkRouteDependencies
  const authRoutes = new OpenAPIHono<{ Variables: AppVariables }>()
  const ownerRoutes = new OpenAPIHono<{ Variables: AppVariables }>()
  const dogRoutes = new OpenAPIHono<{ Variables: AppVariables }>()
  const walkRoutes = new OpenAPIHono<{ Variables: AppVariables }>()
  const healthRoutes = new OpenAPIHono<{ Variables: AppVariables }>()
  const composedApp = new OpenAPIHono<{ Variables: AppVariables }>()
  let receivedDatabase: DbInstance | undefined
  let receivedCognitoClient: CognitoClient | undefined
  let receivedAuthProvider: AuthProvider | undefined
  let receivedOwnerRepository: OwnerRepository | undefined
  let receivedDogRepository: DogRepository | undefined
  let receivedWalkRepository: WalkRepository | undefined
  let receivedActiveWalkCommands: ActiveWalkCommands | undefined
  let receivedAccessTokenVerifier: AccessTokenVerifier | undefined
  let receivedUseCases: AuthRouteDependencies | undefined
  let receivedOwnerRouteDependencies: OwnerRouteDependencies | undefined
  let receivedDogRouteDependencies: DogRouteDependencies | undefined
  let receivedWalkRouteDependencies: WalkRouteDependencies | undefined
  let receivedRoutes: ModuleRoute[] | undefined

  const factories: ApplicationFactories = {
    loadConfigs(processEnv) {
      calls.push('config')
      assert.equal(processEnv, env)
      return {
        database: { user: 'user', password: 'password', database: 'db', host: '127.0.0.1', port: 5432, poolMax: 10 },
        cognito: { region: 'ap-northeast-1', userPoolId: 'pool', clientId: 'client' },
        observability: { environment: 'test', release: 'test-release', sentryDsn: undefined },
      }
    },
    createLogger() {
      calls.push('logger')
      return { kind: 'logger' } as unknown as Logger
    },
    createDatabase(config: DatabaseConfig) {
      calls.push('database')
      assert.equal(config.host, '127.0.0.1')
      return database
    },
    createCognitoClient(config: CognitoConfig) {
      calls.push('cognito-client')
      assert.equal(config.clientId, 'client')
      return cognitoClient
    },
    createAuthProvider(client) {
      calls.push('auth-provider')
      receivedCognitoClient = client
      return authProvider
    },
    createOwnerRepository(databaseInstance) {
      calls.push('owner-repository')
      receivedDatabase = databaseInstance
      return ownerRepository
    },
    createDogRepository(databaseInstance) {
      calls.push('dog-repository')
      assert.equal(databaseInstance, receivedDatabase)
      return dogRepository
    },
    createWalkRepository(databaseInstance) {
      calls.push('walk-repository')
      assert.equal(databaseInstance, receivedDatabase)
      return walkRepository
    },
    createActiveWalkCommands(walks) {
      calls.push('active-walk-commands')
      receivedWalkRepository = walks
      return activeWalkCommands
    },
    createAccessTokenVerifier(config) {
      calls.push('access-token-verifier')
      assert.equal(config.userPoolId, 'pool')
      return accessTokenVerifier
    },
    createUseCases(dependencies) {
      calls.push('use-cases')
      receivedAuthProvider = dependencies.authProvider
      receivedOwnerRepository = dependencies.ownerRepository
      receivedDogRepository = dependencies.dogRepository
      assert.equal(dependencies.walkRepository, walkRepository)
      receivedActiveWalkCommands = dependencies.activeWalkCommands
      receivedAccessTokenVerifier = dependencies.accessTokenVerifier
      return useCases
    },
    createAuthRoutes(dependencies) {
      calls.push('auth-routes')
      receivedUseCases = dependencies
      return authRoutes
    },
    createOwnerRoutes(dependencies) {
      calls.push('owner-routes')
      receivedOwnerRouteDependencies = dependencies
      return ownerRoutes
    },
    createDogRoutes(dependencies) {
      calls.push('dog-routes')
      receivedDogRouteDependencies = dependencies
      return dogRoutes
    },
    createWalkRoutes(dependencies) {
      calls.push('walk-routes')
      receivedWalkRouteDependencies = dependencies
      return walkRoutes
    },
    createHealthRoutes() {
      calls.push('health-routes')
      return healthRoutes
    },
    createApp(dependencies: AppDependencies, routes: ModuleRoute[]) {
      calls.push('app')
      assert.ok(dependencies.logger)
      assert.equal(typeof dependencies.setRequestId, 'function')
      receivedRoutes = routes
      return composedApp
    },
  }

  assert.deepEqual(calls, [])
  const { app, resources } = createApplication(env, factories)

  assert.deepEqual(calls, [
    'config',
    'logger',
    'database',
    'cognito-client',
    'auth-provider',
    'owner-repository',
    'dog-repository',
    'walk-repository',
    'active-walk-commands',
    'access-token-verifier',
    'use-cases',
    'auth-routes',
    'owner-routes',
    'dog-routes',
    'walk-routes',
    'health-routes',
    'app',
  ])
  assert.equal(app, composedApp)
  assert.equal(resources.pool, database.pool)
  assert.equal(resources.cognitoClient, cognitoClient)
  assert.equal(receivedDatabase, database.db)
  assert.equal(receivedCognitoClient, cognitoClient)
  assert.equal(receivedAuthProvider, authProvider)
  assert.equal(receivedOwnerRepository, ownerRepository)
  assert.equal(receivedDogRepository, dogRepository)
  assert.equal(receivedWalkRepository, walkRepository)
  assert.equal(receivedActiveWalkCommands, activeWalkCommands)
  assert.equal(receivedAccessTokenVerifier, accessTokenVerifier)
  assert.equal(receivedUseCases, useCases)
  assert.equal(receivedOwnerRouteDependencies, useCases)
  assert.equal(receivedDogRouteDependencies, useCases)
  assert.equal(receivedWalkRouteDependencies, useCases)
  assert.deepEqual(
    receivedRoutes?.map((route) => ({ path: route.path, app: route.app })),
    [
      { path: '/', app: healthRoutes },
      { path: '/v1/auth', app: authRoutes },
      { path: '/v1/owner', app: ownerRoutes },
      { path: '/v1/dogs', app: dogRoutes },
      { path: '/v1/walks', app: walkRoutes },
    ],
  )
})
