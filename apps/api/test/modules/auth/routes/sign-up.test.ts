import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSignUpRoute, signUpRoute } from '../../../../src/modules/auth/routes/sign-up.js'
import type { StartSignUp, StartSignUpResult } from '../../../../src/modules/auth/types.js'
import { createAuthApp } from '../fixtures.js'

assert.equal(signUpRoute.method, 'post')
assert.equal(signUpRoute.path, '/v1/auth/sign-up')

function createStartSignUpFake(result: StartSignUpResult | ((input: { email: string }) => Promise<StartSignUpResult>)): {
  startSignUp: StartSignUp
  calls: Array<{ email: string }>
} {
  const calls: Array<{ email: string }> = []
  return {
    calls,
    startSignUp: async (input) => {
      calls.push(input)
      return typeof result === 'function' ? result(input) : result
    },
  }
}

const request = (app: ReturnType<typeof createAuthApp>, email = 'test@example.com') => app.request('/v1/auth/sign-up', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })

test('POST /v1/auth/sign-up returns 200 with session for valid email', async () => {
  const { startSignUp, calls } = createStartSignUpFake({
    outcome: 'challenge',
    username: 'test@example.com',
    session: 'test-session',
    codeDelivery: { destination: 't***@t***', attribute: 'email' },
  })
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, startSignUp) }))
  const body = await response.json() as { requestId: string; username: string; session: string; codeDelivery: { destination: string } }
  assert.equal(response.status, 200)
  assert.ok(body.requestId)
  assert.equal(body.username, 'test@example.com')
  assert.equal(body.session, 'test-session')
  assert.equal(body.codeDelivery.destination, 't***@t***')
  assert.deepEqual(calls, [{ email: 'test@example.com' }])
})

test('POST /v1/auth/sign-up returns 409 for an existing confirmed user', async () => {
  const { startSignUp, calls } = createStartSignUpFake({ outcome: 'already-confirmed' })
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, startSignUp) }))
  assert.equal(response.status, 409)
  assert.equal((await response.json() as { code: string }).code, 'AUTHENTICATION_FAILED')
  assert.deepEqual(calls, [{ email: 'test@example.com' }])
})

test('POST /v1/auth/sign-up resends OTP for an existing unconfirmed user', async () => {
  const { startSignUp, calls } = createStartSignUpFake({
    outcome: 'challenge',
    username: 'test@example.com',
    session: null,
    codeDelivery: { destination: 'r***@e***', attribute: 'email' },
  })
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, startSignUp) }))
  const body = await response.json() as { username: string; session: null; codeDelivery: { destination: string } }
  assert.equal(response.status, 200)
  assert.equal(body.username, 'test@example.com')
  assert.equal(body.session, null)
  assert.equal(body.codeDelivery.destination, 'r***@e***')
  assert.deepEqual(calls, [{ email: 'test@example.com' }])
})

test('POST /v1/auth/sign-up returns 400 for Cognito invalid input', async () => {
  const { startSignUp, calls } = createStartSignUpFake({ outcome: 'invalid-input' })
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, startSignUp) }))
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT')
  assert.deepEqual(calls, [{ email: 'test@example.com' }])
})

test('POST /v1/auth/sign-up returns 400 for an invalid email', async () => {
  const { startSignUp, calls } = createStartSignUpFake({
    outcome: 'challenge',
    username: 'ignored',
    session: null,
    codeDelivery: null,
  })
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, startSignUp) }), 'not-an-email')
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'INVALID_INPUT')
  assert.equal(body.message, '入力内容を確認してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('POST /v1/auth/sign-up returns 400 for a malformed JSON body', async () => {
  const { startSignUp, calls } = createStartSignUpFake({
    outcome: 'challenge',
    username: 'ignored',
    session: null,
    codeDelivery: null,
  })
  const response = await createAuthApp((app) => { registerSignUpRoute(app, startSignUp) }).request('/v1/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{email:',
  })
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'INVALID_INPUT')
  assert.equal(body.message, '入力内容を確認してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('POST /v1/auth/sign-up returns 429 when rate limited', async () => {
  const { startSignUp, calls } = createStartSignUpFake({ outcome: 'rate-limited' })
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, startSignUp) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 429)
  assert.equal(body.code, 'RATE_LIMITED')
  assert.equal(body.message, 'しばらく待ってから再試行してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, true)
  assert.deepEqual(calls, [{ email: 'test@example.com' }])
})

test('POST /v1/auth/sign-up returns 500 when the use case throws', async () => {
  const { startSignUp, calls } = createStartSignUpFake(async () => {
    throw new Error('unexpected sign-up failure')
  })
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, startSignUp) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 500)
  assert.equal(body.code, 'INTERNAL_ERROR')
  assert.equal(body.message, 'An unexpected error occurred.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ email: 'test@example.com' }])
})
