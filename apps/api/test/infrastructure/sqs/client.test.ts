import assert from 'node:assert/strict'
import test from 'node:test'
import { createSqsClient } from '../../../src/infrastructure/sqs/client.js'

test('createSqsClient uses the region when endpoint is omitted', async () => {
  const client = createSqsClient({
    region: 'ap-northeast-1',
    queueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123/track-points',
    endpoint: undefined,
  })
  assert.equal(await client.config.region(), 'ap-northeast-1')
  client.destroy()
})

test('createSqsClient uses the provided endpoint', async () => {
  const client = createSqsClient({
    region: 'ap-northeast-1',
    queueUrl: 'http://localhost:9324/queue/track-points',
    endpoint: 'http://localhost:9324',
  })
  const endpoint = await client.config.endpoint()
  assert.equal(endpoint?.hostname, 'localhost')
  assert.equal(endpoint?.port, 9324)
  client.destroy()
})
