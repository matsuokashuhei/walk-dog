import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { createLogger, type Logger } from '../src/observability/logger.js'
import { setRequestIdTag } from '../src/observability/sentry.js'
import { testLogger } from './test-logger.js'

function createCapturingLogger() {
  const lines: Array<Record<string, unknown>> = []
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(String(chunk)) as Record<string, unknown>)
      callback()
    },
  })

  return {
    logger: createLogger({ environment: 'test', release: 'test-release' }, destination),
    lines,
  }
}

test('writes a structured HTTP completion log with requestId correlation', async () => {
  const { logger, lines } = createCapturingLogger()

  await createApp({ logger, setRequestId: setRequestIdTag }).request('/health', {
    headers: { 'X-Request-Id': 'log-request-1' },
  })

  assert.equal(lines.length, 1)
  assert.equal(lines[0]?.service, 'api')
  assert.equal(lines[0]?.environment, 'test')
  assert.equal(lines[0]?.release, 'test-release')
  assert.equal(lines[0]?.requestId, 'log-request-1')
  assert.equal(lines[0]?.method, 'GET')
  assert.equal(lines[0]?.route, '/health')
  assert.equal(lines[0]?.status, 200)
  assert.equal(typeof lines[0]?.duration, 'number')
  assert.ok(typeof lines[0]?.time === 'string')
  assert.ok(typeof lines[0]?.level === 'number' || typeof lines[0]?.level === 'string')
})

test('exposes a request-scoped child logger on the Hono context', async () => {
  const { logger, lines } = createCapturingLogger()
  let requestLogger: Logger | undefined

  await createApp({ logger, setRequestId: setRequestIdTag }, (app) => {
    app.get('/log-check', (context) => {
      requestLogger = context.get('logger')
      context.get('logger').info({ step: 'handler' }, 'handler log')
      return context.json({ ok: true })
    })
  }).request('/log-check', {
    headers: { 'X-Request-Id': 'child-logger-1' },
  })

  assert.ok(requestLogger)
  assert.equal(requestLogger.bindings().requestId, 'child-logger-1')
  assert.ok(lines.some((line) => line.step === 'handler' && line.requestId === 'child-logger-1'))
})

test('binds requestId on the Sentry isolation path', async () => {
  const requestIds: string[] = []

  const response = await createApp({
    logger: testLogger,
    setRequestId: (requestId) => {
      requestIds.push(requestId)
    },
  }, (app) => {
    app.get('/test-error', () => {
      throw new Error('expected observability error')
    })
  }).request('/test-error', {
    headers: { 'X-Request-Id': 'sentry-request-1' },
  })

  assert.equal(response.status, 500)
  assert.equal(requestIds.at(-1), 'sentry-request-1')
})

test('responses include secure headers', async () => {
  const response = await createApp({
    logger: testLogger,
    setRequestId: setRequestIdTag,
  }).request('/health')

  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
})
