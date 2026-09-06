import {
  QueryCommand,
  type AttributeValue,
  type DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import type { ConfirmedTrackPoints } from '../../modules/walks/provider.js'
import type { DynamoDbConfig } from '../config/index.js'

type DynamoDbSender = Pick<DynamoDBClient, 'send'>

function recordedAtFromItem(item: Record<string, AttributeValue>): Date {
  const recordedAt = item.recordedAt.S
  if (recordedAt === undefined) {
    throw new Error('confirmed track point missing recordedAt')
  }
  return new Date(recordedAt)
}

export function createListConfirmedRecordedAt(
  client: DynamoDbSender,
  config: DynamoDbConfig,
): ConfirmedTrackPoints {
  return {
    async listRecordedAt(walkId) {
      const recordedAt: Date[] = []
      let exclusiveStartKey: Record<string, AttributeValue> | undefined

      do {
        const response = await client.send(new QueryCommand({
          TableName: config.tableName,
          KeyConditionExpression: 'walkId = :walkId',
          ExpressionAttributeValues: {
            ':walkId': { S: walkId },
          },
          ExclusiveStartKey: exclusiveStartKey,
        }))

        for (const item of response.Items ?? []) {
          recordedAt.push(recordedAtFromItem(item))
        }

        exclusiveStartKey = response.LastEvaluatedKey
      } while (exclusiveStartKey !== undefined)

      return recordedAt
    },
  }
}
