import assert from 'node:assert/strict'
import test from 'node:test'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { createEnqueueTrackPoint } from '../../../src/infrastructure/sqs/enqueue-track-point.js'

const sqsConfig = {
  region: 'ap-northeast-1',
  queueUrl: 'http://localhost:9324/queue/track-points',
  endpoint: 'http://localhost:9324',
}

const trackPoint = {
  trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  recordedAt: new Date('2026-08-17T03:12:14.000Z'),
  latitude: 35.681236,
  longitude: 139.767125,
}

test('enqueue sends the TrackPoint JSON to the configured queue URL', async () => {
  const sent: unknown[] = []
  const queue = createEnqueueTrackPoint(
    { send: async (command) => { sent.push(command); return {} } },
    {
      region: 'ap-northeast-1',
      queueUrl: 'http://localhost:9324/queue/track-points',
      endpoint: 'http://localhost:9324',
    },
  )
  await queue.enqueue({
    trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
    walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
    recordedAt: new Date('2026-08-17T03:12:14.000Z'),
    latitude: 35.681236,
    longitude: 139.767125,
  })
  const command = sent[0] as SendMessageCommand
  assert.equal(command.input.QueueUrl, 'http://localhost:9324/queue/track-points')
  assert.equal(
    command.input.MessageBody,
    JSON.stringify({
      trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
      walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
      recordedAt: '2026-08-17T03:12:14.000Z',
      latitude: 35.681236,
      longitude: 139.767125,
    }),
  )
})

test('enqueue throws SDK failures through', async () => {
  const failure = new Error('sqs unavailable')
  const queue = createEnqueueTrackPoint(
    {
      send: async () => {
        throw failure
      },
    },
    sqsConfig,
  )

  await assert.rejects(
    () => queue.enqueue(trackPoint),
    (error: unknown) => error === failure,
  )
})
