import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSignInRoute, signInRoute } from '../../../../src/modules/auth/routes/sign-in.js'
import type { StartSignIn, StartSignInResult } from '../../../../src/modules/auth/types.js'
import { createAuthApp } from '../fixtures.js'

assert.equal(signInRoute.method, 'post')
assert.equal(signInRoute.path, '/v1/auth/sign-in')

function createStartSignInFake(result: StartSignInResult | ((input: { email: string }) => Promise<StartSignInResult>)): {
  startSignIn: StartSignIn
  calls: Array<{ email: string }>
} {
  const calls: Array<{ email: string }> = []
  return {
    calls,
    startSignIn: async (input) => {
      calls.push(input)
      return typeof result === 'function' ? result(input) : result
    },
  }
}

const request = (app: ReturnType<typeof createAuthApp>) => app.request('/v1/auth/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.com' }) })

test('POST /v1/auth/sign-in returns 400 for an invalid email', async () => {
  const { startSignIn, calls } = createStartSignInFake({
    outcome: 'challenge',
    username: 'ignored',
    session: 'ignored',
    codeDelivery: { destination: '', attribute: 'email' },
  })
  const app = createAuthApp((routeApp) => { registerSignInRoute(routeApp, startSignIn) })
  const response = await app.request('/v1/auth/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email' }) })
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT')
  assert.deepEqual(calls, [])
})

test('POST /v1/auth/sign-in returns 400 for a malformed JSON body', async () => {
  const { startSignIn, calls } = createStartSignInFake({
    outcome: 'challenge',
    username: 'ignored',
    session: 'ignored',
    codeDelivery: { destination: '', attribute: 'email' },
  })
  const response = await createAuthApp((routeApp) => { registerSignInRoute(routeApp, startSignIn) }).request('/v1/auth/sign-in', {
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

test('POST /v1/auth/sign-in returns an email OTP challenge', async () => {
  const { startSignIn, calls } = createStartSignInFake({
    outcome: 'challenge',
    username: 'test@example.com',
    session: 'sign-in-session',
    codeDelivery: { destination: 't***@t***', attribute: 'email' },
  })
  const response = await request(createAuthApp((app) => { registerSignInRoute(app, startSignIn) }))
  const body = await response.json() as { username: string; session: string; codeDelivery: { destination: string; attribute: string } }
  assert.equal(response.status, 200)
  assert.equal(body.username, 'test@example.com')
  assert.equal(body.session, 'sign-in-session')
  assert.equal(body.codeDelivery.destination, 't***@t***')
  assert.equal(body.codeDelivery.attribute, 'email')
  assert.deepEqual(calls, [{ email: 'test@example.com' }])
})

test('POST /v1/auth/sign-in returns 429 when Cognito rate limits the challenge', async () => {
  const { startSignIn, calls } = createStartSignInFake({ outcome: 'rate-limited' })
  const response = await request(createAuthApp((app) => { registerSignInRoute(app, startSignIn) }))
  assert.equal(response.status, 429)
  assert.equal((await response.json() as { code: string }).code, 'RATE_LIMITED')
  assert.deepEqual(calls, [{ email: 'test@example.com' }])
})

test('POST /v1/auth/sign-in returns 409 when authentication fails', async () => {
  const { startSignIn, calls } = createStartSignInFake({ outcome: 'authentication-failed' })
  const response = await request(createAuthApp((app) => { registerSignInRoute(app, startSignIn) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 409)
  assert.equal(body.code, 'AUTHENTICATION_FAILED')
  assert.equal(body.message, 'サインインに失敗しました。入力内容を確認してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ email: 'test@example.com' }])
})

test('POST /v1/auth/sign-in returns 500 for an incomplete challenge', async () => {
  const { startSignIn, calls } = createStartSignInFake({ outcome: 'incomplete-challenge' })
  const response = await request(createAuthApp((app) => { registerSignInRoute(app, startSignIn) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 500)
  assert.equal(body.code, 'INTERNAL_SERVER_ERROR')
  assert.equal(body.message, '認証情報の取得に失敗しました。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, true)
  assert.deepEqual(calls, [{ email: 'test@example.com' }])
})

test('POST /v1/auth/sign-in returns 500 when the use case throws', async () => {
  const { startSignIn, calls } = createStartSignInFake(async () => {
    throw new Error('unexpected sign-in failure')
  })
  const response = await request(createAuthApp((app) => { registerSignInRoute(app, startSignIn) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 500)
  assert.equal(body.code, 'INTERNAL_ERROR')
  assert.equal(body.message, 'An unexpected error occurred.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ email: 'test@example.com' }])
})
