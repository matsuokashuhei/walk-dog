import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ConditionalCheckFailedException,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { createConfirmTrackPoint } from '../../../src/infrastructure/dynamodb/confirm-track-point.js'

const dynamoDbConfig = {
  region: 'ap-northeast-1',
  tableName: 'TrackPoints',
  endpoint: 'http://localhost:8000',
}

const trackPoint = {
  trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  recordedAt: new Date('2026-08-17T03:12:14.000Z'),
  latitude: 35.681236,
  longitude: 139.767125,
}

test('confirm puts walkId+recordedAt and treats ConditionalCheckFailed as already confirmed', async () => {
  const sent: unknown[] = []
  const store = createConfirmTrackPoint(
    { send: async (command) => { sent.push(command); return {} } },
    dynamoDbConfig,
  )
  await store.confirm(trackPoint)
  const command = sent[0] as PutItemCommand
  const item = command.input.Item
  assert.ok(item)
  assert.equal(command.input.TableName, 'TrackPoints')
  assert.equal(item.walkId.S, '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80')
  assert.equal(item.recordedAt.S, '2026-08-17T03:12:14.000Z')
  assert.equal(item.trackPointId.S, '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90')
  assert.equal(item.latitude.N, '35.681236')
  assert.equal(item.longitude.N, '139.767125')
  assert.equal(command.input.ConditionExpression, 'attribute_not_exists(walkId)')
})

test('confirm resolves when PutItem fails with ConditionalCheckFailedException', async () => {
  const failed = new ConditionalCheckFailedException({
    message: 'conditional',
    $metadata: {},
  })
  const store = createConfirmTrackPoint(
    {
      send: async () => {
        throw failed
      },
    },
    { region: 'ap-northeast-1', tableName: 'TrackPoints', endpoint: undefined },
  )
  await assert.doesNotReject(() => store.confirm(trackPoint))
})

test('confirm throws SDK failures through', async () => {
  const failure = new Error('dynamodb unavailable')
  const store = createConfirmTrackPoint(
    {
      send: async () => {
        throw failure
      },
    },
    dynamoDbConfig,
  )

  await assert.rejects(
    () => store.confirm(trackPoint),
    (error: unknown) => error === failure,
  )
})
