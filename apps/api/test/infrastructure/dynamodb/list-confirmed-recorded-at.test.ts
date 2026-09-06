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

test('listRecordedAt queries by walkId and returns recordedAt dates', async () => {
  const sends: unknown[] = []
  const client = {
    async send(command: unknown) {
      sends.push(command)
      return {
        Items: [
          { walkId: { S: walkId }, recordedAt: { S: '2026-09-06T03:12:14.000Z' } },
        ],
      }
    },
  }
  const confirmed = createListConfirmedRecordedAt(client, dynamoDbConfig)
  assert.deepEqual(await confirmed.listRecordedAt(walkId), [
    new Date('2026-09-06T03:12:14.000Z'),
  ])
  const command = sends[0] as QueryCommand
  assert.equal(command.input.TableName, 'TrackPoints')
  assert.equal(command.input.KeyConditionExpression, 'walkId = :walkId')
  assert.equal(command.input.ExpressionAttributeValues?.[':walkId'].S, walkId)
})

test('listRecordedAt returns empty array when no items', async () => {
  const confirmed = createListConfirmedRecordedAt(
    { send: async () => ({ Items: [] }) },
    dynamoDbConfig,
  )
  assert.deepEqual(await confirmed.listRecordedAt(walkId), [])

  const emptyItems = createListConfirmedRecordedAt(
    { send: async () => ({}) },
    dynamoDbConfig,
  )
  assert.deepEqual(await emptyItems.listRecordedAt(walkId), [])
})

test('listRecordedAt paginates with ExclusiveStartKey while LastEvaluatedKey is present', async () => {
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
      if (callCount === 1) {
        return {
          Items: [{ walkId: { S: walkId }, recordedAt: { S: '2026-09-06T03:12:14.000Z' } }],
          LastEvaluatedKey: lastKey,
        }
      }
      return {
        Items: [{ walkId: { S: walkId }, recordedAt: { S: '2026-09-06T03:13:00.000Z' } }],
      }
    },
  }
  const confirmed = createListConfirmedRecordedAt(client, dynamoDbConfig)
  assert.deepEqual(await confirmed.listRecordedAt(walkId), [
    new Date('2026-09-06T03:12:14.000Z'),
    new Date('2026-09-06T03:13:00.000Z'),
  ])
  assert.equal(sends.length, 2)
  const secondCommand = sends[1] as QueryCommand
  assert.deepEqual(secondCommand.input.ExclusiveStartKey, lastKey)
})
