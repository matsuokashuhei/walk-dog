import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  type DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import type { DynamoDbConfig } from '../config/index.js'

type DynamoDbSender = Pick<DynamoDBClient, 'send'>

export async function ensureTrackPointsTable(
  client: DynamoDbSender,
  config: DynamoDbConfig,
): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: config.tableName }))
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) {
      throw error
    }
    await client.send(new CreateTableCommand({
      TableName: config.tableName,
      AttributeDefinitions: [
        { AttributeName: 'walkId', AttributeType: 'S' },
        { AttributeName: 'recordedAt', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'walkId', KeyType: 'HASH' },
        { AttributeName: 'recordedAt', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    }))
  }
}
