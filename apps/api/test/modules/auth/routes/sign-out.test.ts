import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSignOutRoute, signOutRoute } from '../../../../src/modules/auth/routes/sign-out.js'
import type { SignOut, SignOutResult } from '../../../../src/modules/auth/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createAuthApp } from '../fixtures.js'

assert.equal(signOutRoute.method, 'post')
assert.equal(signOutRoute.path, '/sign-out')
assert.deepEqual(signOutRoute.security, [{ BearerAuth: [] }])

function createSignOutFake(result: SignOutResult | ((input: {
  cognitoSubject: string
  accessToken: string
}) => Promise<SignOutResult>)): {
  signOut: SignOut
  calls: Array<{ cognitoSubject: string; accessToken: string }>
} {
  const calls: Array<{ cognitoSubject: string; accessToken: string }> = []
  return {
    calls,
    signOut: async (input) => {
      calls.push(input)
      return typeof result === 'function' ? result(input) : result
    },
  }
}

function createSignOutApp(
  signOut: SignOut,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: 'sub-1',
  }),
) {
  return createAuthApp((routeApp) => {
    routeApp.use('/sign-out', createAuthenticationMiddleware({ verify }))
    registerSignOutRoute(routeApp, signOut)
  })
}

const authorizedRequest = {
  method: 'POST' as const,
  headers: {
    Authorization: 'Bearer access',
    'Content-Type': 'application/json',
  },
  body: '{}',
}

test('POST /v1/auth/sign-out returns 204', async () => {
  const { signOut, calls } = createSignOutFake({ outcome: 'signed-out' })
  const response = await createSignOutApp(signOut).request('/v1/auth/sign-out', authorizedRequest)
  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
  assert.deepEqual(calls, [{ cognitoSubject: 'sub-1', accessToken: 'access' }])
})

test('POST /v1/auth/sign-out returns 401 without calling use case when Authorization is missing', async () => {
  const { signOut, calls } = createSignOutFake({ outcome: 'signed-out' })
  const response = await createSignOutApp(signOut, async () => {
    throw new Error('should not verify')
  }).request('/v1/auth/sign-out', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const body = await response.json() as {
    code: string
    message: string
    requestId: string
    retryable: boolean
  }
  assert.equal(response.status, 401)
  assert.equal(body.code, 'UNAUTHENTICATED')
  assert.equal(body.message, 'Authentication is required.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('POST /v1/auth/sign-out returns 400 for unexpected body fields', async () => {
  const { signOut, calls } = createSignOutFake({ outcome: 'signed-out' })
  const response = await createSignOutApp(signOut).request('/v1/auth/sign-out', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer access',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ discardActiveWalk: true }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT')
  assert.deepEqual(calls, [])
})

test('POST /v1/auth/sign-out returns 401 when Cognito sign-out fails authentication', async () => {
  const { signOut, calls } = createSignOutFake({ outcome: 'authentication-failed' })
  const response = await createSignOutApp(signOut).request('/v1/auth/sign-out', authorizedRequest)
  const body = await response.json() as {
    code: string
    message: string
    requestId: string
    retryable: boolean
  }
  assert.equal(response.status, 401)
  assert.equal(body.code, 'UNAUTHENTICATED')
  assert.equal(body.message, 'Authentication is required.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ cognitoSubject: 'sub-1', accessToken: 'access' }])
})

test('POST /v1/auth/sign-out returns 429 when Cognito rate limits sign-out', async () => {
  const { signOut, calls } = createSignOutFake({ outcome: 'rate-limited' })
  const response = await createSignOutApp(signOut).request('/v1/auth/sign-out', authorizedRequest)
  const body = await response.json() as {
    code: string
    message: string
    requestId: string
    retryable: boolean
  }
  assert.equal(response.status, 429)
  assert.equal(body.code, 'RATE_LIMITED')
  assert.equal(body.message, 'しばらく待ってから再試行してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, true)
  assert.deepEqual(calls, [{ cognitoSubject: 'sub-1', accessToken: 'access' }])
})

test('POST /v1/auth/sign-out returns 500 when the use case throws', async () => {
  const { signOut, calls } = createSignOutFake(async () => {
    throw new Error('unexpected sign-out failure')
  })
  const response = await createSignOutApp(signOut).request('/v1/auth/sign-out', authorizedRequest)
  const body = await response.json() as {
    code: string
    message: string
    requestId: string
    retryable: boolean
  }
  assert.equal(response.status, 500)
  assert.equal(body.code, 'INTERNAL_ERROR')
  assert.equal(body.message, 'An unexpected error occurred.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [{ cognitoSubject: 'sub-1', accessToken: 'access' }])
})
