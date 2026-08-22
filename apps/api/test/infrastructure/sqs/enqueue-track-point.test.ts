import assert from 'node:assert/strict'
import test from 'node:test'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { createEnqueueTrackPoint } from '../../../src/infrastructure/sqs/enqueue-track-point.js'

const sqsConfig = {
  region: 'ap-northeast-1',
  queueUrl: 'http://localhost:9324/queue/track-points',
  endpoint: 'http://localhost:9324',
}

test('enqueue sends the given body to the configured queue URL', async () => {
  const sent: unknown[] = []
  const enqueue = createEnqueueTrackPoint(
    { send: async (command) => { sent.push(command); return {} } },
    sqsConfig,
  )
  await enqueue.enqueue('{"ok":true}')
  const command = sent[0] as SendMessageCommand
  assert.equal(command.input.QueueUrl, 'http://localhost:9324/queue/track-points')
  assert.equal(command.input.MessageBody, '{"ok":true}')
})

test('enqueue throws SDK failures through', async () => {
  const failure = new Error('sqs unavailable')
  const enqueue = createEnqueueTrackPoint(
    {
      send: async () => {
        throw failure
      },
    },
    sqsConfig,
  )

  await assert.rejects(
    () => enqueue.enqueue('{"ok":true}'),
    (error: unknown) => error === failure,
  )
})
