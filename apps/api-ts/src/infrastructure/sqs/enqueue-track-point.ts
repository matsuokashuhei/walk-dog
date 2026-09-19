import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs'
import type { SqsConfig } from '../config/index.js'

type SqsSender = Pick<SQSClient, 'send'>

export function createEnqueueTrackPoint(
  client: SqsSender,
  config: SqsConfig,
) {
  return {
    async enqueue(messageBody: string): Promise<void> {
      await client.send(new SendMessageCommand({
        QueueUrl: config.queueUrl,
        MessageBody: messageBody,
      }))
    },
  }
}
