import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from 'pg'
import { loadDatabaseConfig } from '../../src/config.js'

const config = loadDatabaseConfig(process.env)

test('migration creates owners and enforces subject uniqueness', async () => {
  const client = new Client({ connectionString: config.databaseUrl })
  await client.connect()
  try {
    await client.query('TRUNCATE owners')
    await client.query("INSERT INTO owners (cognito_subject) VALUES ('subject-1')")
    await assert.rejects(client.query("INSERT INTO owners (cognito_subject) VALUES ('subject-1')"), /unique/i)
  } finally {
    await client.query('TRUNCATE owners')
    await client.end()
  }
})
