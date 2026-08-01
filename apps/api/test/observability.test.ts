import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { createLogger } from '../src/observability/logger.js'

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

  await createApp(undefined, { logger }).request('/health', {
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

test('captures thrown errors through the Sentry bridge', async () => {
  const captured: unknown[] = []
  const requestIds: string[] = []

  const response = await createApp((app) => {
    app.get('/test-error', () => {
      throw new Error('expected observability error')
    })
  }, {
    sentry: {
      setRequestId: (requestId) => {
        requestIds.push(requestId)
      },
      captureException: (error) => {
        captured.push(error)
      },
    },
  }).request('/test-error', {
    headers: { 'X-Request-Id': 'sentry-request-1' },
  })

  assert.equal(response.status, 500)
  assert.equal(requestIds.at(-1), 'sentry-request-1')
  assert.equal(captured.length, 1)
  assert.ok(captured[0] instanceof Error)
})

test('responses include secure headers', async () => {
  const response = await createApp().request('/health')

  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
})
