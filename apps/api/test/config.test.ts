import assert from 'node:assert/strict'
import test from 'node:test'
import { loadDatabaseConfig, loadCognitoConfig, loadObservabilityConfig } from '../src/config.js'

test('loads DATABASE_URL and defaults DATABASE_POOL_MAX to 10', () => {
  assert.deepEqual(loadDatabaseConfig({ DATABASE_URL: 'postgresql://walk:dog@localhost/walkdog' }), {
    databaseUrl: 'postgresql://walk:dog@localhost/walkdog',
    poolMax: 10,
  })
})

test('loads an explicit DATABASE_POOL_MAX', () => {
  assert.equal(
    loadDatabaseConfig({
      DATABASE_URL: 'postgresql://walk:dog@localhost/walkdog',
      DATABASE_POOL_MAX: '4',
    }).poolMax,
    4,
  )
})

test('rejects a missing DATABASE_URL', () => {
  assert.throws(() => loadDatabaseConfig({}), /DATABASE_URL is required/)
})

test('rejects an empty DATABASE_URL', () => {
  assert.throws(() => loadDatabaseConfig({ DATABASE_URL: '' }), /DATABASE_URL must be a valid URL/)
})

test('rejects a non-PostgreSQL DATABASE_URL', () => {
  assert.throws(() => loadDatabaseConfig({ DATABASE_URL: 'https://example.com/database' }), /DATABASE_URL must be a PostgreSQL URL/)
})

test('rejects an invalid DATABASE_URL', () => {
  assert.throws(() => loadDatabaseConfig({ DATABASE_URL: 'not-a-url' }), /DATABASE_URL must be a valid URL/)
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
