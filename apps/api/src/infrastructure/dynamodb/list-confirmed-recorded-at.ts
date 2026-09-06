import {
  QueryCommand,
  type AttributeValue,
  type DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import type {
  ConfirmedTrackPoint,
  ConfirmedTrackPoints,
} from '../../modules/walks/provider.js'
import type { DynamoDbConfig } from '../config/index.js'

type DynamoDbSender = Pick<DynamoDBClient, 'send'>

function numberFromItem(item: Record<string, AttributeValue>, key: 'latitude' | 'longitude'): number {
  const value = item[key].N
  if (value === undefined) {
    throw new Error(`confirmed track point missing ${key}`)
  }
  return Number(value)
}

function pointFromItem(item: Record<string, AttributeValue>): ConfirmedTrackPoint {
  const recordedAt = item.recordedAt.S
  if (recordedAt === undefined) {
    throw new Error('confirmed track point missing recordedAt')
  }
  return {
    recordedAt: new Date(recordedAt),
    latitude: numberFromItem(item, 'latitude'),
    longitude: numberFromItem(item, 'longitude'),
  }
}

export function createListConfirmedRecordedAt(
  client: DynamoDbSender,
  config: DynamoDbConfig,
): ConfirmedTrackPoints {
  async function listPoints(walkId: string): Promise<ConfirmedTrackPoint[]> {
    const points: ConfirmedTrackPoint[] = []
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
        points.push(pointFromItem(item))
      }

      exclusiveStartKey = response.LastEvaluatedKey
    } while (exclusiveStartKey !== undefined)

    return points
  }

  return {
    listPoints,
    async listRecordedAt(walkId) {
      const points = await listPoints(walkId)
      return points.map((point) => point.recordedAt)
    },
  }
}
