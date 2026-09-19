import assert from 'node:assert/strict'
import test from 'node:test'
import {
  loadDatabaseConfig,
  loadCognitoConfig,
  loadDynamoDbConfig,
  loadObservabilityConfig,
  loadSqsConfig,
  loadWorkerHealthConfig,
  loadWorkerListenConfig,
  FINISH_CONFIRMATION_TIMEOUT_MS,
} from '../src/infrastructure/config/index.js'

const validPostgresEnv = {
  POSTGRES_USER: 'walkdog',
  POSTGRES_PASSWORD: 'walkdog',
  POSTGRES_DB: 'walkdog',
  POSTGRES_HOST: 'postgres',
  POSTGRES_PORT: '5432',
}

test('loads POSTGRES_* and defaults DATABASE_POOL_MAX to 10', () => {
  assert.deepEqual(loadDatabaseConfig(validPostgresEnv), {
    user: 'walkdog',
    password: 'walkdog',
    database: 'walkdog',
    host: 'postgres',
    port: 5432,
    poolMax: 10,
  })
})

test('loads an explicit DATABASE_POOL_MAX', () => {
  assert.equal(
    loadDatabaseConfig({
      ...validPostgresEnv,
      DATABASE_POOL_MAX: '4',
    }).poolMax,
    4,
  )
})

test('rejects a missing POSTGRES_USER', () => {
  const env = { ...validPostgresEnv }
  delete (env as { POSTGRES_USER?: string }).POSTGRES_USER
  assert.throws(() => loadDatabaseConfig(env), /POSTGRES_USER/)
})

test('rejects a missing POSTGRES_HOST', () => {
  const env = { ...validPostgresEnv }
  delete (env as { POSTGRES_HOST?: string }).POSTGRES_HOST
  assert.throws(() => loadDatabaseConfig(env), /POSTGRES_HOST/)
})

test('rejects a missing POSTGRES_PORT', () => {
  const env = { ...validPostgresEnv }
  delete (env as { POSTGRES_PORT?: string }).POSTGRES_PORT
  assert.throws(() => loadDatabaseConfig(env), /POSTGRES_PORT/)
})

test('rejects a non-positive POSTGRES_PORT', () => {
  assert.throws(
    () => loadDatabaseConfig({ ...validPostgresEnv, POSTGRES_PORT: '0' }),
    /POSTGRES_PORT/,
  )
})

test('loads ENVIRONMENT, RELEASE, and an empty SENTRY_DSN as disabled', () => {
  assert.deepEqual(
    loadObservabilityConfig({
      ENVIRONMENT: 'development',
      RELEASE: 'local',
      SENTRY_DSN: '',
    }),
    {
      environment: 'development',
      release: 'local',
      sentryDsn: undefined,
    },
  )
})

test('loads a SENTRY_DSN when provided', () => {
  assert.equal(
    loadObservabilityConfig({
      ENVIRONMENT: 'production',
      RELEASE: 'abc123',
      SENTRY_DSN: 'https://key@o0.ingest.sentry.io/1',
    }).sentryDsn,
    'https://key@o0.ingest.sentry.io/1',
  )
})

test('rejects a missing ENVIRONMENT', () => {
  assert.throws(
    () => loadObservabilityConfig({ RELEASE: 'local' }),
    /ENVIRONMENT is required/,
  )
})

test('rejects a missing RELEASE', () => {
  assert.throws(
    () => loadObservabilityConfig({ ENVIRONMENT: 'development' }),
    /RELEASE is required/,
  )
})

test('loads Cognito configuration', () => {
  assert.deepEqual(
    loadCognitoConfig({
      AWS_REGION: 'ap-northeast-1',
      COGNITO_USER_POOL_ID: 'ap-northeast-1_abc123',
      COGNITO_CLIENT_ID: 'test-client-id',
    }),
    { region: 'ap-northeast-1', userPoolId: 'ap-northeast-1_abc123', clientId: 'test-client-id' },
  )
})

test('rejects missing AWS_REGION', () => {
  assert.throws(
    () => loadCognitoConfig({ COGNITO_USER_POOL_ID: 'pool', COGNITO_CLIENT_ID: 'client' }),
    /AWS_REGION/,
  )
})

test('rejects missing COGNITO_USER_POOL_ID', () => {
  assert.throws(
    () => loadCognitoConfig({ COGNITO_REGION: 'region', COGNITO_CLIENT_ID: 'client' }),
    /COGNITO_USER_POOL_ID/,
  )
})

test('rejects missing COGNITO_CLIENT_ID', () => {
  assert.throws(
    () => loadCognitoConfig({ COGNITO_REGION: 'region', COGNITO_USER_POOL_ID: 'pool' }),
    /COGNITO_CLIENT_ID/,
  )
})

const validSqsEnv = {
  AWS_REGION: 'ap-northeast-1',
  SQS_QUEUE_URL: 'http://localhost:9324/queue/track-points',
  SQS_ENDPOINT: 'http://localhost:9324',
}

test('loads SQS_QUEUE_URL, AWS_REGION, and SQS_ENDPOINT', () => {
  assert.deepEqual(loadSqsConfig(validSqsEnv), {
    region: 'ap-northeast-1',
    queueUrl: 'http://localhost:9324/queue/track-points',
    endpoint: 'http://localhost:9324',
  })
})

test('treats blank SQS_ENDPOINT as undefined', () => {
  assert.equal(loadSqsConfig({ ...validSqsEnv, SQS_ENDPOINT: '' }).endpoint, undefined)
})

test('rejects a missing SQS_QUEUE_URL', () => {
  const env = { ...validSqsEnv }
  delete (env as { SQS_QUEUE_URL?: string }).SQS_QUEUE_URL
  assert.throws(() => loadSqsConfig(env), /SQS_QUEUE_URL/)
})

test('rejects a missing AWS_REGION', () => {
  const env = { ...validSqsEnv }
  delete (env as { AWS_REGION?: string }).AWS_REGION
  assert.throws(() => loadSqsConfig(env), /AWS_REGION/)
})

const validDynamoDbEnv = {
  AWS_REGION: 'ap-northeast-1',
  DYNAMODB_TABLE: 'TrackPoints',
  DYNAMODB_ENDPOINT: 'http://localhost:8000',
}

test('loads DYNAMODB_TABLE, AWS_REGION, and DYNAMODB_ENDPOINT', () => {
  assert.deepEqual(loadDynamoDbConfig(validDynamoDbEnv), {
    region: 'ap-northeast-1',
    tableName: 'TrackPoints',
    endpoint: 'http://localhost:8000',
  })
})

test('treats blank DYNAMODB_ENDPOINT as undefined', () => {
  assert.equal(loadDynamoDbConfig({ ...validDynamoDbEnv, DYNAMODB_ENDPOINT: '' }).endpoint, undefined)
})

test('rejects a missing DYNAMODB_TABLE', () => {
  const env = { ...validDynamoDbEnv }
  delete (env as { DYNAMODB_TABLE?: string }).DYNAMODB_TABLE
  assert.throws(() => loadDynamoDbConfig(env), /DYNAMODB_TABLE/)
})

test('finish confirmation timeout is 30 seconds', () => {
  assert.equal(FINISH_CONFIRMATION_TIMEOUT_MS, 30_000)
})

test('loads WORKER_HEALTH_URL', () => {
  assert.deepEqual(
    loadWorkerHealthConfig({ WORKER_HEALTH_URL: 'https://worker:3001/health' }),
    { workerHealthUrl: 'https://worker:3001/health' },
  )
})

test('rejects a missing WORKER_HEALTH_URL', () => {
  assert.throws(() => loadWorkerHealthConfig({}), /WORKER_HEALTH_URL/)
})

test('loads WORKER_HEALTH_PORT', () => {
  assert.deepEqual(loadWorkerListenConfig({ WORKER_HEALTH_PORT: '3001' }), { port: 3001 })
})

test('rejects a missing WORKER_HEALTH_PORT', () => {
  assert.throws(() => loadWorkerListenConfig({}), /WORKER_HEALTH_PORT/)
})
