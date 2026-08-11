import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSignInVerifyRoute, signInVerifyRoute } from '../../../../src/modules/auth/routes/sign-in-verify.js'
import type { VerifySignIn, VerifySignInResult } from '../../../../src/modules/auth/types.js'
import { createAuthApp } from '../fixtures.js'

assert.equal(signInVerifyRoute.method, 'post')
assert.equal(signInVerifyRoute.path, '/v1/auth/sign-in/verify')

const owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: null,
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const authenticated: VerifySignInResult = {
  outcome: 'authenticated',
  authentication: {
    subject: 'test-cognito-sub',
    accessToken: 'mock-access',
    idToken: 'mock-id',
    refreshToken: 'mock-refresh',
  },
  owner,
}

function createVerifySignInFake(
  result: VerifySignInResult | ((input: { username: string; session: string; code: string }) => Promise<VerifySignInResult>),
): {
  verifySignIn: VerifySignIn
  calls: Array<{ username: string; session: string; code: string }>
} {
  const calls: Array<{ username: string; session: string; code: string }> = []
  return {
    calls,
    verifySignIn: async (input) => {
      calls.push(input)
      return typeof result === 'function' ? result(input) : result
    },
  }
}

const request = (app: ReturnType<typeof createAuthApp>) => app.request('/v1/auth/sign-in/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }),
})

test('POST /v1/auth/sign-in/verify returns 400 for an empty OTP', async () => {
  const { verifySignIn, calls } = createVerifySignInFake(authenticated)
  const app = createAuthApp((routeApp) => { registerSignInVerifyRoute(routeApp, verifySignIn) })
  const response = await app.request('/v1/auth/sign-in/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test@example.com', session: 'sign-in-session', code: '' }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT')
  assert.deepEqual(calls, [])
})

test('POST /v1/auth/sign-in/verify returns 400 for a malformed JSON body', async () => {
  const { verifySignIn, calls } = createVerifySignInFake(authenticated)
  const response = await createAuthApp((routeApp) => { registerSignInVerifyRoute(routeApp, verifySignIn) }).request('/v1/auth/sign-in/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{username:',
  })
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'INVALID_INPUT')
  assert.equal(body.message, '入力内容を確認してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('POST /v1/auth/sign-in/verify returns tokens for a valid OTP', async () => {
  const { verifySignIn, calls } = createVerifySignInFake(authenticated)
  const response = await request(createAuthApp((app) => { registerSignInVerifyRoute(app, verifySignIn) }))
  const body = await response.json() as {
    accessToken: string
    idToken: string
    refreshToken: string
    owner: { ownerId: string }
  }
  assert.equal(response.status, 200)
  assert.equal(body.accessToken, 'mock-access')
  assert.equal(body.idToken, 'mock-id')
  assert.equal(body.refreshToken, 'mock-refresh')
  assert.equal(body.owner.ownerId, '019fc312-f7eb-73c4-9351-2a6ea25e4fcb')
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }])
})

test('POST /v1/auth/sign-in/verify returns CODE_EXPIRED for an expired OTP', async () => {
  const { verifySignIn, calls } = createVerifySignInFake({ outcome: 'code-expired' })
  const response = await request(createAuthApp((app) => { registerSignInVerifyRoute(app, verifySignIn) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'CODE_EXPIRED')
  assert.equal(body.message, 'コードの有効期限が切れました。コードを再送してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, true)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }])
})

test('POST /v1/auth/sign-in/verify returns INVALID_CODE for a mismatched OTP', async () => {
  const { verifySignIn, calls } = createVerifySignInFake({ outcome: 'invalid-code' })
  const response = await request(createAuthApp((app) => { registerSignInVerifyRoute(app, verifySignIn) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'INVALID_CODE')
  assert.equal(body.message, 'コードが正しくありません。同じコードで再試行するか、最初からやり直してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }])
})

test('POST /v1/auth/sign-in/verify returns CODE_ALREADY_USED when the alias exists', async () => {
  const { verifySignIn, calls } = createVerifySignInFake({ outcome: 'code-already-used' })
  const response = await request(createAuthApp((app) => { registerSignInVerifyRoute(app, verifySignIn) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'CODE_ALREADY_USED')
  assert.equal(body.message, 'このコードは既に使用されています。サインインしてください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }])
})

test('POST /v1/auth/sign-in/verify tells the user to resend after an invalid challenge session', async () => {
  const { verifySignIn, calls } = createVerifySignInFake({ outcome: 'authentication-failed' })
  const response = await request(createAuthApp((app) => { registerSignInVerifyRoute(app, verifySignIn) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 409)
  assert.equal(body.code, 'AUTHENTICATION_FAILED')
  assert.equal(body.message, '認証情報の有効期限が切れました。コードを再送してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, true)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }])
})

test('POST /v1/auth/sign-in/verify returns 429 when rate limited', async () => {
  const { verifySignIn, calls } = createVerifySignInFake({ outcome: 'rate-limited' })
  const response = await request(createAuthApp((app) => { registerSignInVerifyRoute(app, verifySignIn) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 429)
  assert.equal(body.code, 'RATE_LIMITED')
  assert.equal(body.message, 'しばらく待ってから再試行してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, true)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }])
})

test('POST /v1/auth/sign-in/verify returns 500 for incomplete authentication', async () => {
  const { verifySignIn, calls } = createVerifySignInFake({ outcome: 'incomplete-authentication' })
  const response = await request(createAuthApp((app) => { registerSignInVerifyRoute(app, verifySignIn) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 500)
  assert.equal(body.code, 'INTERNAL_SERVER_ERROR')
  assert.equal(body.message, '認証情報の取得に失敗しました。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, true)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }])
})

test('POST /v1/auth/sign-in/verify returns 500 when the use case throws', async () => {
  const { verifySignIn, calls } = createVerifySignInFake(async () => {
    throw new Error('unexpected verify sign-in failure')
  })
  const response = await request(createAuthApp((app) => { registerSignInVerifyRoute(app, verifySignIn) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 500)
  assert.equal(body.code, 'INTERNAL_ERROR')
  assert.equal(body.message, 'An unexpected error occurred.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }])
})
