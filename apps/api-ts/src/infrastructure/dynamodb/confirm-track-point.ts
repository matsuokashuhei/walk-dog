import {
  ConditionalCheckFailedException,
  PutItemCommand,
  type DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import type { ConfirmTrackPoint } from '../../modules/walks/provider.js'
import type { DynamoDbConfig } from '../config/index.js'

type DynamoDbSender = Pick<DynamoDBClient, 'send'>

export function createConfirmTrackPoint(
  client: DynamoDbSender,
  config: DynamoDbConfig,
): ConfirmTrackPoint {
  return {
    async confirm(trackPoint) {
      try {
        await client.send(new PutItemCommand({
          TableName: config.tableName,
          Item: {
            walkId: { S: trackPoint.walkId },
            recordedAt: { S: trackPoint.recordedAt.toISOString() },
            trackPointId: { S: trackPoint.trackPointId },
            latitude: { N: String(trackPoint.latitude) },
            longitude: { N: String(trackPoint.longitude) },
          },
          ConditionExpression: 'attribute_not_exists(walkId)',
        }))
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          return
        }
        throw error
      }
    },
  }
}
