import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import type { DynamoDbConfig } from '../config/index.js'

export function createDynamoDbClient(config: DynamoDbConfig): DynamoDBClient {
  if (config.endpoint === undefined) {
    return new DynamoDBClient({ region: config.region })
  }

  return new DynamoDBClient({
    region: config.region,
    endpoint: config.endpoint,
  })
}
