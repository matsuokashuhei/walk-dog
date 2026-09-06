import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { createListConfirmedRecordedAt } from '../../../src/infrastructure/dynamodb/list-confirmed-recorded-at.js'

const dynamoDbConfig = {
  region: 'ap-northeast-1',
  tableName: 'TrackPoints',
  endpoint: 'http://localhost:8000',
}

const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'

const pointItem1 = {
  walkId: { S: walkId },
  recordedAt: { S: '2026-09-06T03:12:14.000Z' },
  latitude: { N: '35.0' },
  longitude: { N: '139.0' },
}

const pointItem2 = {
  walkId: { S: walkId },
  recordedAt: { S: '2026-09-06T03:13:00.000Z' },
  latitude: { N: '35.001' },
  longitude: { N: '139.0' },
}

test('listPoints queries by walkId and returns confirmed track points', async () => {
  const sends: unknown[] = []
  const client = {
    async send(command: unknown) {
      sends.push(command)
      return { Items: [pointItem1] }
    },
  }
  const confirmed = createListConfirmedRecordedAt(client, dynamoDbConfig)
  assert.deepEqual(await confirmed.listPoints(walkId), [
    {
      recordedAt: new Date('2026-09-06T03:12:14.000Z'),
      latitude: 35.0,
      longitude: 139.0,
    },
  ])
  const command = sends[0] as QueryCommand
  assert.equal(command.input.TableName, 'TrackPoints')
  assert.equal(command.input.KeyConditionExpression, 'walkId = :walkId')
  assert.equal(command.input.ExpressionAttributeValues?.[':walkId'].S, walkId)
})

test('listRecordedAt projects recordedAt from listPoints', async () => {
  const confirmed = createListConfirmedRecordedAt(
    { send: async () => ({ Items: [pointItem1] }) },
    dynamoDbConfig,
  )
  assert.deepEqual(await confirmed.listRecordedAt(walkId), [
    new Date('2026-09-06T03:12:14.000Z'),
  ])
})

test('listPoints returns empty array when no items', async () => {
  const confirmed = createListConfirmedRecordedAt(
    { send: async () => ({ Items: [] }) },
    dynamoDbConfig,
  )
  assert.deepEqual(await confirmed.listPoints(walkId), [])
  assert.deepEqual(await confirmed.listRecordedAt(walkId), [])

  const emptyItems = createListConfirmedRecordedAt(
    { send: async () => ({}) },
    dynamoDbConfig,
  )
  assert.deepEqual(await emptyItems.listPoints(walkId), [])
})

test('listPoints paginates with ExclusiveStartKey while LastEvaluatedKey is present', async () => {
  const sends: unknown[] = []
  let callCount = 0
  const lastKey = {
    walkId: { S: walkId },
    recordedAt: { S: '2026-09-06T03:12:14.000Z' },
  }
  const client = {
    async send(command: unknown) {
      sends.push(command)
      callCount += 1
      if (callCount % 2 === 1) {
        return {
          Items: [pointItem1],
          LastEvaluatedKey: lastKey,
        }
      }
      return {
        Items: [pointItem2],
      }
    },
  }
  const confirmed = createListConfirmedRecordedAt(client, dynamoDbConfig)
  assert.deepEqual(await confirmed.listPoints(walkId), [
    {
      recordedAt: new Date('2026-09-06T03:12:14.000Z'),
      latitude: 35.0,
      longitude: 139.0,
    },
    {
      recordedAt: new Date('2026-09-06T03:13:00.000Z'),
      latitude: 35.001,
      longitude: 139.0,
    },
  ])
  assert.deepEqual(await confirmed.listRecordedAt(walkId), [
    new Date('2026-09-06T03:12:14.000Z'),
    new Date('2026-09-06T03:13:00.000Z'),
  ])
  assert.equal(sends.length, 4)
  const secondCommand = sends[1] as QueryCommand
  assert.deepEqual(secondCommand.input.ExclusiveStartKey, lastKey)
})
