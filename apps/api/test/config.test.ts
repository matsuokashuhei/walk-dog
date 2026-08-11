import assert from 'node:assert/strict'
import test from 'node:test'
import { loadDatabaseConfig, loadCognitoConfig, loadObservabilityConfig } from '../src/config.js'

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
  const { POSTGRES_USER: _removed, ...env } = validPostgresEnv
  assert.throws(() => loadDatabaseConfig(env), /POSTGRES_USER/)
})

test('rejects a missing POSTGRES_HOST', () => {
  const { POSTGRES_HOST: _removed, ...env } = validPostgresEnv
  assert.throws(() => loadDatabaseConfig(env), /POSTGRES_HOST/)
})

test('rejects a missing POSTGRES_PORT', () => {
  const { POSTGRES_PORT: _removed, ...env } = validPostgresEnv
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
