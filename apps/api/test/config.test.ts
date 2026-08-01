import assert from 'node:assert/strict'
import test from 'node:test'
import { loadDatabaseConfig, loadObservabilityConfig } from '../src/config.js'

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
