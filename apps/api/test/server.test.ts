import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import type { Pool } from 'pg'
import type { App } from '../src/shared/http/types.js'
import {
  createShutdownHandler,
  isDirectRun,
  startServer,
  type HttpServer,
} from '../src/server.js'
import { apiRoot, runNode, sanitizedEnv } from './support/subprocess.js'

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

test('importing server.ts does not start a listener', async () => {
  const result = await runNode(
    [
      '--import',
      'tsx',
      '-e',
      `
        import { createShutdownHandler, startServer } from './src/server.ts'
        console.log('IMPORT_OK')
        console.log(typeof startServer)
        console.log(typeof createShutdownHandler)
      `,
    ],
    sanitizedEnv(),
  )

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /IMPORT_OK/)
  assert.match(result.stdout, /function/)
})

test('startServer wires createApplication, listener start, and signals once', () => {
  const calls: string[] = []
  const fakeApp = {
    fetch: async () => new Response('ok'),
  } as unknown as App
  const fakeServer: HttpServer = {
    close: (callback) => {
      callback()
    },
  }
  const signalHandlers = new Map<'SIGINT' | 'SIGTERM', () => void>()

  const { server, shutdown } = startServer({
    env: { NODE_ENV: 'test' },
    createApplication(env) {
      calls.push('createApplication')
      assert.equal(env.NODE_ENV, 'test')
      return {
        app: fakeApp,
        resources: {
          pool: { end: async () => { calls.push('pool') } } as Pool,
          cognitoClient: { destroy: () => { calls.push('cognito') } },
          sqsClient: { destroy: () => { calls.push('sqs') } },
          dynamoDbClient: { destroy: () => { calls.push('dynamodb') } },
          closeSentry: async () => { calls.push('sentry') },
        },
      }
    },
    start(options) {
      calls.push('start')
      assert.equal(options.port, 3000)
      assert.equal(options.fetch, fakeApp.fetch)
      return fakeServer
    },
    process: {
      once(event, listener) {
        calls.push(`signal:${event}`)
        signalHandlers.set(event, listener)
      },
    },
  })

  assert.equal(server, fakeServer)
  assert.equal(typeof shutdown, 'function')
  assert.deepEqual(calls, [
    'createApplication',
    'start',
    'signal:SIGINT',
    'signal:SIGTERM',
  ])
  assert.equal(signalHandlers.size, 2)
})

test('closes the database pool and Sentry after the HTTP server has stopped', async () => {
  const calls: string[] = []
  let completeClose: (() => void) | undefined
  const shutdown = createShutdownHandler(
    {
      close: (callback?: (error?: Error) => void) => {
        calls.push('server closing')
        completeClose = () => callback?.()
      },
    },
    { end: async () => { calls.push('pool') } } as Pool,
    { destroy: () => { calls.push('cognito') } },
    { destroy: () => { calls.push('sqs') } },
    { destroy: () => { calls.push('dynamodb') } },
    { close: async () => { calls.push('sentry') } },
  )

  const shutdownPromise = shutdown()

  assert.deepEqual(calls, ['server closing'])

  completeClose?.()
  await shutdownPromise

  assert.deepEqual(calls, ['server closing', 'pool', 'cognito', 'sqs', 'dynamodb', 'sentry'])
})

test('closes the database pool and Sentry when stopping the HTTP server fails', async () => {
  const calls: string[] = []
  const serverError = new Error('server close failed')
  const shutdown = createShutdownHandler(
    {
      close: (callback) => {
        calls.push('server closing')
        callback(serverError)
      },
    },
    { end: async () => { calls.push('pool') } } as Pool,
    { destroy: () => { calls.push('cognito') } },
    { destroy: () => { calls.push('sqs') } },
    { destroy: () => { calls.push('dynamodb') } },
    { close: async () => { calls.push('sentry') } },
  )

  await assert.rejects(shutdown(), (error) => error === serverError)

  assert.deepEqual(calls, ['server closing', 'pool', 'cognito', 'sqs', 'dynamodb', 'sentry'])
})

test('shutdown closes each resource exactly once in listener, pool, cognito, sqs, dynamodb, sentry order', async () => {
  const calls: string[] = []
  const shutdown = createShutdownHandler(
    {
      close: (callback) => {
        calls.push('server')
        callback()
      },
    },
    { end: async () => { calls.push('pool') } } as Pool,
    { destroy: () => { calls.push('cognito') } },
    { destroy: () => { calls.push('sqs') } },
    { destroy: () => { calls.push('dynamodb') } },
    { close: async () => { calls.push('sentry') } },
  )

  await shutdown()
  await shutdown()

  assert.deepEqual(calls, ['server', 'pool', 'cognito', 'sqs', 'dynamodb', 'sentry'])
})

test('concurrent and repeated shutdown share one idempotent promise', async () => {
  const calls: string[] = []
  const deferred = createDeferred()
  const shutdown = createShutdownHandler(
    {
      close: (callback) => {
        calls.push('server')
        void deferred.promise.then(() => {
          callback()
        })
      },
    },
    { end: async () => { calls.push('pool') } } as Pool,
    { destroy: () => { calls.push('cognito') } },
    { destroy: () => { calls.push('sqs') } },
    { destroy: () => { calls.push('dynamodb') } },
    { close: async () => { calls.push('sentry') } },
  )

  const first = shutdown()
  const second = shutdown()
  assert.equal(first, second)
  assert.deepEqual(calls, ['server'])

  deferred.resolve()
  await Promise.all([first, second, shutdown()])

  assert.deepEqual(calls, ['server', 'pool', 'cognito', 'sqs', 'dynamodb', 'sentry'])
  assert.equal(shutdown(), first)
})

test('listener close errors still close downstream resources exactly once', async () => {
  const calls: string[] = []
  const serverError = new Error('listener close failed')
  const shutdown = createShutdownHandler(
    {
      close: (callback) => {
        calls.push('server')
        callback(serverError)
      },
    },
    { end: async () => { calls.push('pool') } } as Pool,
    { destroy: () => { calls.push('cognito') } },
    { destroy: () => { calls.push('sqs') } },
    { destroy: () => { calls.push('dynamodb') } },
    { close: async () => { calls.push('sentry') } },
  )

  const first = shutdown()
  const second = shutdown()
  assert.equal(first, second)

  await assert.rejects(first, (error) => error === serverError)
  await assert.rejects(second, (error) => error === serverError)
  await assert.rejects(shutdown(), (error) => error === serverError)

  assert.deepEqual(calls, ['server', 'pool', 'cognito', 'sqs', 'dynamodb', 'sentry'])
})

test('pool close errors still attempt cognito and sentry closes exactly once', async () => {
  const calls: string[] = []
  const poolError = new Error('pool close failed')
  const shutdown = createShutdownHandler(
    {
      close: (callback) => {
        calls.push('server')
        callback()
      },
    },
    {
      end: async () => {
        calls.push('pool')
        throw poolError
      },
    } as Pool,
    { destroy: () => { calls.push('cognito') } },
    { destroy: () => { calls.push('sqs') } },
    { destroy: () => { calls.push('dynamodb') } },
    { close: async () => { calls.push('sentry') } },
  )

  const first = shutdown()
  const second = shutdown()
  assert.equal(first, second)

  await assert.rejects(first, (error) => error === poolError)
  await assert.rejects(shutdown(), (error) => error === poolError)

  assert.deepEqual(calls, ['server', 'pool', 'cognito', 'sqs', 'dynamodb', 'sentry'])
})

test('cognito destroy errors still attempt sqs and sentry closes exactly once', async () => {
  const calls: string[] = []
  const cognitoError = new Error('cognito destroy failed')
  const shutdown = createShutdownHandler(
    {
      close: (callback) => {
        calls.push('server')
        callback()
      },
    },
    { end: async () => { calls.push('pool') } } as Pool,
    {
      destroy: () => {
        calls.push('cognito')
        throw cognitoError
      },
    },
    { destroy: () => { calls.push('sqs') } },
    { destroy: () => { calls.push('dynamodb') } },
    { close: async () => { calls.push('sentry') } },
  )

  const first = shutdown()
  assert.equal(shutdown(), first)

  await assert.rejects(first, (error) => error === cognitoError)
  await assert.rejects(shutdown(), (error) => error === cognitoError)

  assert.deepEqual(calls, ['server', 'pool', 'cognito', 'sqs', 'dynamodb', 'sentry'])
})

test('sqs destroy errors still attempt dynamodb and sentry closes exactly once', async () => {
  const calls: string[] = []
  const sqsError = new Error('sqs destroy failed')
  const shutdown = createShutdownHandler(
    {
      close: (callback) => {
        calls.push('server')
        callback()
      },
    },
    { end: async () => { calls.push('pool') } } as Pool,
    { destroy: () => { calls.push('cognito') } },
    {
      destroy: () => {
        calls.push('sqs')
        throw sqsError
      },
    },
    { destroy: () => { calls.push('dynamodb') } },
    { close: async () => { calls.push('sentry') } },
  )

  const first = shutdown()
  assert.equal(shutdown(), first)

  await assert.rejects(first, (error) => error === sqsError)
  await assert.rejects(shutdown(), (error) => error === sqsError)

  assert.deepEqual(calls, ['server', 'pool', 'cognito', 'sqs', 'dynamodb', 'sentry'])
})

test('dynamodb destroy errors still attempt sentry close exactly once', async () => {
  const calls: string[] = []
  const dynamodbError = new Error('dynamodb destroy failed')
  const shutdown = createShutdownHandler(
    {
      close: (callback) => {
        calls.push('server')
        callback()
      },
    },
    { end: async () => { calls.push('pool') } } as Pool,
    { destroy: () => { calls.push('cognito') } },
    { destroy: () => { calls.push('sqs') } },
    {
      destroy: () => {
        calls.push('dynamodb')
        throw dynamodbError
      },
    },
    { close: async () => { calls.push('sentry') } },
  )

  const first = shutdown()
  assert.equal(shutdown(), first)

  await assert.rejects(first, (error) => error === dynamodbError)
  await assert.rejects(shutdown(), (error) => error === dynamodbError)

  assert.deepEqual(calls, ['server', 'pool', 'cognito', 'sqs', 'dynamodb', 'sentry'])
})

test('package scripts target source and built server entrypoints', async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(apiRoot, 'package.json'), 'utf8'),
  ) as { scripts: { dev: string; start: string } }

  assert.match(packageJson.scripts.dev, /(?:^|[\s/])src\/server\.ts(?:\s|$)/)
  assert.match(packageJson.scripts.start, /(?:^|[\s/])dist\/server\.js(?:\s|$)/)
})

test('isDirectRun recognizes source and dist entry paths', () => {
  const sourcePath = resolve(apiRoot, 'src/server.ts')
  const distPath = resolve(apiRoot, 'dist/server.js')

  assert.equal(isDirectRun(pathToFileURL(sourcePath).href, sourcePath), true)
  assert.equal(isDirectRun(pathToFileURL(distPath).href, distPath), true)
  assert.equal(isDirectRun(pathToFileURL(sourcePath).href, distPath), false)
  assert.equal(isDirectRun(pathToFileURL(sourcePath).href, undefined), false)
})

test('direct source server execution invokes startup', async () => {
  const result = await runNode(
    ['--import', 'tsx', resolve(apiRoot, 'src/server.ts')],
    sanitizedEnv(),
  )

  assert.notEqual(result.status, 0)
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /POSTGRES_|AWS_REGION|COGNITO_|ENVIRONMENT|RELEASE|Invalid|Required/i,
  )
})
