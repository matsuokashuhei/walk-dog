import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSignUpVerifyRoute } from '../src/routes/sign-up-verify.js'
import { cognitoError, createAuthApp, mockCognito, mockDb } from './auth-fixtures.js'

const request = (app: ReturnType<typeof createAuthApp>, code = '123456') => app.request('/v1/auth/sign-up/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@example.com', session: 'test-session', code }) })

test('POST /v1/auth/sign-up/verify returns 400 for an empty verification code', async () => {
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, mockDb(), mockCognito()) }), '')
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT')
})

test('POST /v1/auth/sign-up/verify returns tokens for a valid code', async () => {
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, mockDb(), mockCognito()) }))
  const body = await response.json() as { requestId: string; accessToken: string; idToken: string; refreshToken: string; owner: { ownerId: string; displayName: null } }
  assert.equal(response.status, 200)
  assert.ok(body.requestId)
  assert.equal(body.accessToken, 'mock-access-token')
  assert.ok(body.idToken)
  assert.equal(body.refreshToken, 'mock-refresh-token')
  assert.ok(body.owner.ownerId)
  assert.equal(body.owner.displayName, null)
})

test('POST /v1/auth/sign-up/verify returns 400 for an invalid code', async () => {
  const cognito = mockCognito({ confirmSignUp: async () => { throw cognitoError('CodeMismatchException') } })
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, mockDb(), cognito) }), '000000')
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_CODE')
})

test('POST /v1/auth/sign-up/verify returns 409 for an already confirmed user', async () => {
  const cognito = mockCognito({ confirmSignUp: async () => { throw cognitoError('NotAuthorizedException') } })
  const response = await request(createAuthApp((app) => { registerSignUpVerifyRoute(app, mockDb(), cognito) }), '000000')
  assert.equal(response.status, 409)
  assert.equal((await response.json() as { code: string }).code, 'AUTHENTICATION_FAILED')
})
