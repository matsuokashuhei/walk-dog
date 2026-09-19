import assert from 'node:assert/strict'
import test from 'node:test'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { createTrackPointQueue } from '../../../src/infrastructure/sqs/track-point-queue.js'
import { toTrackPointMessage } from '../../../src/modules/walks/track-point-message.js'

const trackPoint = {
  trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  recordedAt: new Date('2026-08-17T03:12:14.000Z'),
  latitude: 35.681236,
  longitude: 139.767125,
}

test('TrackPointQueue enqueues the mapped TrackPoint message', async () => {
  const sent: unknown[] = []
  const queue = createTrackPointQueue(
    { send: async (command) => { sent.push(command); return {} } },
    {
      region: 'ap-northeast-1',
      queueUrl: 'http://localhost:9324/queue/track-points',
      endpoint: 'http://localhost:9324',
    },
  )
  await queue.enqueue(trackPoint)
  const command = sent[0] as SendMessageCommand
  assert.equal(command.input.QueueUrl, 'http://localhost:9324/queue/track-points')
  assert.equal(command.input.MessageBody, toTrackPointMessage(trackPoint))
})
