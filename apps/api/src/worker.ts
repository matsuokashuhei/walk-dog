import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  type ReceiveMessageCommandOutput,
  type SQSClient,
} from '@aws-sdk/client-sqs'
import { createServer, type Server } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadDynamoDbConfig,
  loadObservabilityConfig,
  loadSqsConfig,
  loadWorkerListenConfig,
} from './infrastructure/config/index.js'
import { createDynamoDbClient } from './infrastructure/dynamodb/client.js'
import { createConfirmTrackPoint } from './infrastructure/dynamodb/confirm-track-point.js'
import { ensureTrackPointsTable } from './infrastructure/dynamodb/ensure-table.js'
import { createLogger, type Logger } from './infrastructure/observability/logger.js'
import { closeSentry } from './infrastructure/observability/sentry.js'
import { createSqsClient } from './infrastructure/sqs/client.js'
import type { ConfirmTrackPoint } from './modules/walks/provider.js'
import type { TrackPoint } from './modules/walks/types.js'

export type ProcessSqsMessagesInput = {
  sqs: Pick<SQSClient, 'send'>
  queueUrl: string
  confirm: ConfirmTrackPoint
  logger: Logger
  shouldContinue: () => boolean
}

export type SignalProcess = {
  once: (event: 'SIGINT' | 'SIGTERM', listener: () => void) => void
}

export type StartWorkerOptions = {
  env?: NodeJS.ProcessEnv
  process?: SignalProcess
}

export function startWorkerHealthListener(port: number): Server {
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ status: 'ok' }))
      return
    }
    response.writeHead(404)
    response.end()
  })
  server.listen(port)
  return server
}

function parseTrackPointMessage(body: string): TrackPoint {
  const parsed = JSON.parse(body) as Record<string, unknown>
  if (
    typeof parsed.trackPointId !== 'string'
    || typeof parsed.walkId !== 'string'
    || typeof parsed.recordedAt !== 'string'
    || typeof parsed.latitude !== 'number'
    || typeof parsed.longitude !== 'number'
  ) {
    throw new Error('invalid track point message')
  }
  return {
    trackPointId: parsed.trackPointId,
    walkId: parsed.walkId,
    recordedAt: new Date(parsed.recordedAt),
    latitude: parsed.latitude,
    longitude: parsed.longitude,
  }
}

async function handleQueueMessage(
  input: ProcessSqsMessagesInput,
  body: string | undefined,
  receiptHandle: string | undefined,
): Promise<void> {
  let trackPoint: TrackPoint
  try {
    trackPoint = parseTrackPointMessage(body ?? '')
  } catch (error) {
    input.logger.error({ err: error }, 'invalid track point message')
    return
  }
  try {
    await input.confirm.confirm(trackPoint)
  } catch (error) {
    input.logger.error({ err: error }, 'failed to confirm track point')
    return
  }
  if (receiptHandle === undefined) {
    return
  }
  try {
    await input.sqs.send(new DeleteMessageCommand({
      QueueUrl: input.queueUrl,
      ReceiptHandle: receiptHandle,
    }))
  } catch (error) {
    input.logger.error({ err: error }, 'failed to delete track point message')
  }
}

export async function processSqsMessages(input: ProcessSqsMessagesInput): Promise<void> {
  while (input.shouldContinue()) {
    let output: ReceiveMessageCommandOutput
    try {
      output = await input.sqs.send(new ReceiveMessageCommand({
        QueueUrl: input.queueUrl,
        WaitTimeSeconds: 20,
        MaxNumberOfMessages: 1,
      }))
    } catch (error) {
      input.logger.error({ err: error }, 'failed to receive track point messages')
      continue
    }
    const message = output.Messages?.[0]
    if (message === undefined) {
      continue
    }
    await handleQueueMessage(input, message.Body, message.ReceiptHandle)
  }
}

async function closeHealthServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

function createWorkerShutdown(input: {
  stop: () => void
  loop: Promise<void>
  healthServer: Server
  sqsClient: { destroy: () => void }
  dynamoDbClient: { destroy: () => void }
}): () => Promise<void> {
  let shutdownPromise: Promise<void> | undefined
  return () => {
    if (shutdownPromise) {
      return shutdownPromise
    }
    shutdownPromise = (async () => {
      input.stop()
      await input.loop
      await closeHealthServer(input.healthServer)
      input.sqsClient.destroy()
      input.dynamoDbClient.destroy()
      await closeSentry()
    })()
    return shutdownPromise
  }
}

export async function startWorker(options: StartWorkerOptions = {}): Promise<{
  shutdown: () => Promise<void>
}> {
  const env = options.env ?? process.env
  const signalProcess = options.process ?? process
  const sqsConfig = loadSqsConfig(env)
  const dynamoDbConfig = loadDynamoDbConfig(env)
  const logger = createLogger(loadObservabilityConfig(env))
  const sqsClient = createSqsClient(sqsConfig)
  const dynamoDbClient = createDynamoDbClient(dynamoDbConfig)
  await ensureTrackPointsTable(dynamoDbClient, dynamoDbConfig)
  const healthServer = startWorkerHealthListener(loadWorkerListenConfig(env).port)
  let running = true
  const shutdown = createWorkerShutdown({
    stop: () => {
      running = false
    },
    loop: processSqsMessages({
      sqs: sqsClient,
      queueUrl: sqsConfig.queueUrl,
      confirm: createConfirmTrackPoint(dynamoDbClient, dynamoDbConfig),
      logger,
      shouldContinue: () => running,
    }),
    healthServer,
    sqsClient,
    dynamoDbClient,
  })
  signalProcess.once('SIGINT', () => {
    void shutdown()
  })
  signalProcess.once('SIGTERM', () => {
    void shutdown()
  })
  return { shutdown }
}

function isDirectRun(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (!argvEntry) {
    return false
  }
  return fileURLToPath(moduleUrl) === resolve(argvEntry)
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  void startWorker()
}
