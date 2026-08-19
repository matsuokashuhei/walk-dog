import assert from 'node:assert/strict'
import { AddressInfo } from 'node:net'
import test from 'node:test'
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
} from '@aws-sdk/client-sqs'
import { testLogger } from './support/test-logger.js'
import { runNode, sanitizedEnv } from './support/subprocess.js'
import {
  processSqsMessages,
  startWorkerHealthListener,
} from '../src/worker.js'

const queueUrl = 'http://localhost:9324/queue/track-points'

const trackPointBody = {
  trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  recordedAt: '2026-08-17T03:12:14.000Z',
  latitude: 35.681236,
  longitude: 139.767125,
}

test('importing worker.ts does not start a listener', async () => {
  const result = await runNode(
    [
      '--import',
      'tsx',
      '-e',
      `
        import { startWorker } from './src/worker.ts'
        console.log('IMPORT_OK')
        console.log(typeof startWorker)
      `,
    ],
    sanitizedEnv(),
  )

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /IMPORT_OK/)
  assert.match(result.stdout, /function/)
})

test('polls SQS with WaitTimeSeconds 20, confirms the TrackPoint, then deletes the message', async () => {
  const sent: unknown[] = []
  const confirmed: unknown[] = []
  let polls = 0
  await processSqsMessages({
    sqs: {
      send: async (command) => {
        sent.push(command)
        if (command instanceof ReceiveMessageCommand) {
          polls += 1
          if (polls === 1) {
            return {
              Messages: [{
                Body: JSON.stringify(trackPointBody),
                ReceiptHandle: 'receipt-1',
              }],
            }
          }
          return { Messages: [] }
        }
        return {}
      },
    },
    queueUrl,
    confirm: {
      async confirm(trackPoint) {
        confirmed.push(trackPoint)
      },
    },
    logger: testLogger,
    shouldContinue: () => polls < 2,
  })

  const receive = sent.find((command) => command instanceof ReceiveMessageCommand)
  assert.ok(receive instanceof ReceiveMessageCommand)
  assert.equal(receive.input.QueueUrl, queueUrl)
  assert.equal(receive.input.WaitTimeSeconds, 20)
  assert.equal(receive.input.MaxNumberOfMessages, 1)
  assert.deepEqual(confirmed, [{
    trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
    walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
    recordedAt: new Date('2026-08-17T03:12:14.000Z'),
    latitude: 35.681236,
    longitude: 139.767125,
  }])
  const deleted = sent.find((command) => command instanceof DeleteMessageCommand)
  assert.ok(deleted instanceof DeleteMessageCommand)
  assert.equal(deleted.input.QueueUrl, queueUrl)
  assert.equal(deleted.input.ReceiptHandle, 'receipt-1')
})

test('keeps polling after ReceiveMessage throws', async () => {
  let polls = 0
  let confirmCalls = 0
  await processSqsMessages({
    sqs: {
      send: async (command) => {
        if (command instanceof ReceiveMessageCommand) {
          polls += 1
          if (polls === 1) {
            throw new Error('receive failed')
          }
          return { Messages: [] }
        }
        return {}
      },
    },
    queueUrl,
    confirm: {
      async confirm() {
        confirmCalls += 1
      },
    },
    logger: testLogger,
    shouldContinue: () => polls < 2,
  })

  assert.equal(polls, 2)
  assert.equal(confirmCalls, 0)
})

test('keeps polling after DeleteMessage throws', async () => {
  let polls = 0
  let deletes = 0
  const confirmed: unknown[] = []
  await processSqsMessages({
    sqs: {
      send: async (command) => {
        if (command instanceof ReceiveMessageCommand) {
          polls += 1
          if (polls === 1) {
            return {
              Messages: [{
                Body: JSON.stringify(trackPointBody),
                ReceiptHandle: 'receipt-1',
              }],
            }
          }
          return { Messages: [] }
        }
        if (command instanceof DeleteMessageCommand) {
          deletes += 1
          throw new Error('delete failed')
        }
        return {}
      },
    },
    queueUrl,
    confirm: {
      async confirm(trackPoint) {
        confirmed.push(trackPoint)
      },
    },
    logger: testLogger,
    shouldContinue: () => polls < 2,
  })

  assert.equal(confirmed.length, 1)
  assert.equal(deletes, 1)
  assert.equal(polls, 2)
})

test('leaves invalid JSON on the queue', async () => {
  const sent: unknown[] = []
  let confirmCalls = 0
  let polls = 0
  await processSqsMessages({
    sqs: {
      send: async (command) => {
        sent.push(command)
        if (command instanceof ReceiveMessageCommand) {
          polls += 1
          if (polls === 1) {
            return {
              Messages: [{
                Body: '{not-json',
                ReceiptHandle: 'receipt-bad',
              }],
            }
          }
          return { Messages: [] }
        }
        return {}
      },
    },
    queueUrl,
    confirm: {
      async confirm() {
        confirmCalls += 1
      },
    },
    logger: testLogger,
    shouldContinue: () => polls < 2,
  })

  assert.equal(confirmCalls, 0)
  assert.equal(
    sent.filter((command) => command instanceof DeleteMessageCommand).length,
    0,
  )
})

test('worker health listener returns 200 { status: ok }', async () => {
  const server = startWorkerHealthListener(0)
  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => {
      resolve()
    })
    server.once('error', reject)
  })
  const address = server.address() as AddressInfo
  const response = await fetch(`http://127.0.0.1:${String(address.port)}/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
})
