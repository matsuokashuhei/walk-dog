import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb'
import { ensureTrackPointsTable } from '../../../src/infrastructure/dynamodb/ensure-table.js'

const dynamoDbConfig = {
  region: 'ap-northeast-1',
  tableName: 'TrackPoints',
  endpoint: 'http://localhost:8000',
}

test('ensureTrackPointsTable creates a pay-per-request table when it is missing', async () => {
  const sent: unknown[] = []
  await ensureTrackPointsTable(
    {
      send: async (command) => {
        sent.push(command)
        if (command instanceof DescribeTableCommand) {
          throw new ResourceNotFoundException({
            message: 'not found',
            $metadata: {},
          })
        }
        return {}
      },
    },
    dynamoDbConfig,
  )

  assert.ok(sent[0] instanceof DescribeTableCommand)
  assert.equal(sent[0].input.TableName, 'TrackPoints')
  const created = sent[1] as CreateTableCommand
  assert.ok(created instanceof CreateTableCommand)
  assert.equal(created.input.TableName, 'TrackPoints')
  assert.equal(created.input.BillingMode, 'PAY_PER_REQUEST')
  assert.deepEqual(created.input.KeySchema, [
    { AttributeName: 'walkId', KeyType: 'HASH' },
    { AttributeName: 'recordedAt', KeyType: 'RANGE' },
  ])
  assert.deepEqual(created.input.AttributeDefinitions, [
    { AttributeName: 'walkId', AttributeType: 'S' },
    { AttributeName: 'recordedAt', AttributeType: 'S' },
  ])
})

test('ensureTrackPointsTable does not create the table when DescribeTable succeeds', async () => {
  const sent: unknown[] = []
  await ensureTrackPointsTable(
    {
      send: async (command) => {
        sent.push(command)
        return {}
      },
    },
    dynamoDbConfig,
  )

  assert.equal(sent.length, 1)
  assert.ok(sent[0] instanceof DescribeTableCommand)
})
