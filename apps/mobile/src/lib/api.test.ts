import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import {
  ApiError,
  apiRequest,
  setAuthenticationFailureHandler,
} from './api.ts'

const originalFetch = globalThis.fetch
const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorBody(code: string) {
  return {
    code,
    message: 'Authentication is required.',
    requestId: 'request-id',
    retryable: false,
  }
}

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalBaseUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl
  }
  setAuthenticationFailureHandler(null)
})

test('notifies authentication failure for an authenticated UNAUTHENTICATED response', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://example.test'
  globalThis.fetch = async () => jsonResponse(errorBody('UNAUTHENTICATED'), 401)
  let notifications = 0
  setAuthenticationFailureHandler(() => {
    notifications += 1
  })

  await assert.rejects(
    apiRequest('/v1/owner', { accessToken: 'expired-token' }),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  )

  assert.equal(notifications, 1)
})

test('does not notify for unauthenticated requests or other API errors', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://example.test'
  const responses = [
    jsonResponse(errorBody('UNAUTHENTICATED'), 401),
    jsonResponse(errorBody('FORBIDDEN'), 401),
    jsonResponse(errorBody('UNAUTHENTICATED'), 500),
  ]
  globalThis.fetch = async () => {
    const response = responses.shift()
    if (!response) {
      throw new Error('unexpected request')
    }
    return response
  }
  let notifications = 0
  setAuthenticationFailureHandler(() => {
    notifications += 1
  })

  await assert.rejects(apiRequest('/v1/auth/sign-in'))
  await assert.rejects(apiRequest('/v1/owner', { accessToken: 'token' }))
  await assert.rejects(apiRequest('/v1/owner', { accessToken: 'token' }))

  assert.equal(notifications, 0)
})
