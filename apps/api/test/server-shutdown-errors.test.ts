import assert from 'node:assert/strict'
import test from 'node:test'
import type { Pool } from 'pg'
import { createShutdownHandler } from '../src/server.js'

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

