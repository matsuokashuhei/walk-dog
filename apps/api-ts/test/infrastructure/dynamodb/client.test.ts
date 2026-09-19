import assert from 'node:assert/strict'
import test from 'node:test'
import { createDynamoDbClient } from '../../../src/infrastructure/dynamodb/client.js'

test('createDynamoDbClient uses the region when endpoint is omitted', async () => {
  const client = createDynamoDbClient({
    region: 'ap-northeast-1',
    tableName: 'track-points',
    endpoint: undefined,
  })
  assert.equal(await client.config.region(), 'ap-northeast-1')
  client.destroy()
})

test('createDynamoDbClient uses the provided endpoint', async () => {
  const client = createDynamoDbClient({
    region: 'ap-northeast-1',
    tableName: 'track-points',
    endpoint: 'http://localhost:8000',
  })
  const endpoint = await client.config.endpoint()
  assert.equal(endpoint.hostname, 'localhost')
  assert.equal(endpoint.port, 8000)
  client.destroy()
})
