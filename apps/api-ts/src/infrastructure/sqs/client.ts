import { SQSClient } from '@aws-sdk/client-sqs'
import type { SqsConfig } from '../config/index.js'

export function createSqsClient(config: SqsConfig): SQSClient {
  if (config.endpoint === undefined) {
    return new SQSClient({ region: config.region })
  }

  return new SQSClient({
    region: config.region,
    endpoint: config.endpoint,
  })
}
