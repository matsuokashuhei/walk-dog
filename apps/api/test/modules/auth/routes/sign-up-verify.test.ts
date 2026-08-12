import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSignUpVerifyRoute, signUpVerifyRoute } from '../../../../src/modules/auth/routes/sign-up-verify.js'
import type { VerifySignUp, VerifySignUpResult } from '../../../../src/modules/auth/types.js'
import { createAuthApp } from '../fixtures.js'

assert.equal(signUpVerifyRoute.method, 'post')
assert.equal(signUpVerifyRoute.path, '/sign-up/verify')

const owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: null,
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const authenticated: VerifySignUpResult = {
  outcome: 'authenticated',
  authentication: {
    subject: 'test-cognito-sub',
    accessToken: 'mock-access-token',
    idToken: 'mock-id-token',
    refreshToken: 'mock-refresh-token',
  },
  owner,
}

function createVerifySignUpFake(
  result: VerifySignUpResult | ((input: { username: string; session: string | null; code: string }) => Promise<VerifySignUpResult>),
): {
  verifySignUp: VerifySignUp
  calls: Array<{ username: string; session: string | null; code: string }>
} {
  const calls: Array<{ username: string; session: string | null; code: string }> = []
  return {
    calls,
    verifySignUp: async (input) => {
      calls.push(input)
      return typeof result === 'function' ? result(input) : result
    },
  }
}

const request = (
  app: ReturnType<typeof createAuthApp>,
  body: { username?: string; session?: string | null; code?: string } = {},
) => app.request('/v1/auth/sign-up/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'test@example.com',
    session: 'test-session',
    code: '123456',
    ...body,
  }),
})

test('POST /v1/auth/sign-up/verify returns 400 for an empty verification code', async () => {
  const { verifySignUp, calls } = createVerifySignUpFake(authenticated)
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, verifySignUp) }), { code: '' })
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT')
  assert.deepEqual(calls, [])
})

test('POST /v1/auth/sign-up/verify returns 400 for a malformed JSON body', async () => {
  const { verifySignUp, calls } = createVerifySignUpFake(authenticated)
  const response = await createAuthApp((app) => { registerSignUpVerifyRoute(app, verifySignUp) }).request('/v1/auth/sign-up/verify', {
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

test('POST /v1/auth/sign-up/verify returns tokens for a valid code', async () => {
  const { verifySignUp, calls } = createVerifySignUpFake(authenticated)
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, verifySignUp) }))
  const body = await response.json() as {
    requestId: string
    accessToken: string
    idToken: string
    refreshToken: string
    owner: { ownerId: string; displayName: null; avatarUrl: null; createdAt: string; updatedAt: string }
  }
  assert.equal(response.status, 200)
  assert.ok(body.requestId)
  assert.equal(body.accessToken, 'mock-access-token')
  assert.equal(body.idToken, 'mock-id-token')
  assert.equal(body.refreshToken, 'mock-refresh-token')
  assert.deepEqual(body.owner, {
    ownerId: owner.ownerId,
    displayName: null,
    avatarUrl: null,
    createdAt: '2026-08-02T15:23:48.068Z',
    updatedAt: '2026-08-02T15:23:48.068Z',
  })
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'test-session', code: '123456' }])
})

test('POST /v1/auth/sign-up/verify returns 400 for an invalid code', async () => {
  const { verifySignUp, calls } = createVerifySignUpFake({ outcome: 'invalid-code' })
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, verifySignUp) }), { code: '000000' })
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'INVALID_CODE')
  assert.equal(body.message, 'コードが正しくありません。同じコードで再試行するか、最初からやり直してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'test-session', code: '000000' }])
})

test('POST /v1/auth/sign-up/verify returns CODE_EXPIRED when the code expired', async () => {
  const { verifySignUp, calls } = createVerifySignUpFake({ outcome: 'code-expired' })
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, verifySignUp) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'CODE_EXPIRED')
  assert.equal(body.message, 'コードの有効期限が切れました。最初からやり直してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'test-session', code: '123456' }])
})

test('POST /v1/auth/sign-up/verify returns CODE_ALREADY_USED when the alias exists', async () => {
  const { verifySignUp, calls } = createVerifySignUpFake({ outcome: 'code-already-used' })
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, verifySignUp) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'CODE_ALREADY_USED')
  assert.equal(body.message, 'このコードは既に使用されています。サインインしてください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'test-session', code: '123456' }])
})

test('POST /v1/auth/sign-up/verify returns 409 for an already confirmed user', async () => {
  const { verifySignUp, calls } = createVerifySignUpFake({ outcome: 'already-confirmed' })
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, verifySignUp) }), { code: '000000' })
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 409)
  assert.equal(body.code, 'AUTHENTICATION_FAILED')
  assert.equal(body.message, 'このアカウントは既に確認済みです。サインインしてください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'test-session', code: '000000' }])
})

test('POST /v1/auth/sign-up/verify returns 429 when rate limited', async () => {
  const { verifySignUp, calls } = createVerifySignUpFake({ outcome: 'rate-limited' })
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, verifySignUp) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 429)
  assert.equal(body.code, 'RATE_LIMITED')
  assert.equal(body.message, 'しばらく待ってから再試行してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, true)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'test-session', code: '123456' }])
})

test('POST /v1/auth/sign-up/verify returns 500 for incomplete authentication', async () => {
  const { verifySignUp, calls } = createVerifySignUpFake({ outcome: 'incomplete-authentication' })
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, verifySignUp) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 500)
  assert.equal(body.code, 'INTERNAL_SERVER_ERROR')
  assert.equal(body.message, '認証情報の取得に失敗しました。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, true)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'test-session', code: '123456' }])
})

test('POST /v1/auth/sign-up/verify returns 500 when the use case throws', async () => {
  const { verifySignUp, calls } = createVerifySignUpFake(async () => {
    throw new Error('unexpected verify sign-up failure')
  })
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, verifySignUp) }))
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 500)
  assert.equal(body.code, 'INTERNAL_ERROR')
  assert.equal(body.message, 'An unexpected error occurred.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ username: 'test@example.com', session: 'test-session', code: '123456' }])
})
