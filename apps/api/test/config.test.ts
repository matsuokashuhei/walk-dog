import assert from 'node:assert/strict'
import test from 'node:test'
import { loadDatabaseConfig } from '../src/config.js'

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
