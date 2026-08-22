import type { SQSClient } from '@aws-sdk/client-sqs'
import type { TrackPointQueue } from '../../modules/walks/provider.js'
import { toTrackPointMessage } from '../../modules/walks/track-point-message.js'
import type { SqsConfig } from '../config/index.js'
import { createEnqueueTrackPoint } from './enqueue-track-point.js'

export function createTrackPointQueue(
  client: Pick<SQSClient, 'send'>,
  config: SqsConfig,
): TrackPointQueue {
  const enqueue = createEnqueueTrackPoint(client, config)
  return {
    enqueue(trackPoint) {
      return enqueue.enqueue(toTrackPointMessage(trackPoint))
    },
  }
}
