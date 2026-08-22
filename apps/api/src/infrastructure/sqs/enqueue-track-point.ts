import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs'
import type { TrackPointQueue } from '../../modules/walks/provider.js'
import type { SqsConfig } from '../config/index.js'

type SqsSender = Pick<SQSClient, 'send'>

export function createEnqueueTrackPoint(
  client: SqsSender,
  config: SqsConfig,
): TrackPointQueue {
  return {
    async enqueue(trackPoint) {
      await client.send(new SendMessageCommand({
        QueueUrl: config.queueUrl,
        MessageBody: JSON.stringify({
          trackPointId: trackPoint.trackPointId,
          walkId: trackPoint.walkId,
          recordedAt: trackPoint.recordedAt.toISOString(),
          latitude: trackPoint.latitude,
          longitude: trackPoint.longitude,
        }),
      }))
    },
  }
}
