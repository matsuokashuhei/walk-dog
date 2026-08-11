import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSignUpRoute } from '../../../../src/routes/sign-up.js'
import { cognitoError, createAuthApp, mockCognito } from '../fixtures.js'

const request = (app: ReturnType<typeof createAuthApp>, email = 'test@example.com') => app.request('/v1/auth/sign-up', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })

test('POST /v1/auth/sign-up returns 200 with session for valid email', async () => {
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, mockCognito()) }))
  const body = await response.json() as { requestId: string; username: string; session: string; codeDelivery: { destination: string } }
  assert.equal(response.status, 200)
  assert.ok(body.requestId)
  assert.equal(body.username, 'test@example.com')
  assert.equal(body.session, 'test-session')
  assert.equal(body.codeDelivery.destination, 't***@t***')
})

test('POST /v1/auth/sign-up returns 409 for an existing confirmed user', async () => {
  const cognito = mockCognito({ signUp: async () => { throw cognitoError('UsernameExistsException') }, resendConfirmationCode: async () => { throw cognitoError('InvalidParameterException') } })
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, cognito) }))
  assert.equal(response.status, 409)
  assert.equal((await response.json() as { code: string }).code, 'AUTHENTICATION_FAILED')
})

test('POST /v1/auth/sign-up resends OTP for an existing unconfirmed user', async () => {
  const cognito = mockCognito({ signUp: async () => { throw cognitoError('UsernameExistsException') }, resendConfirmationCode: async () => ({ CodeDeliveryDetails: { Destination: 'r***@e***', AttributeName: 'email' }, $metadata: {} }) })
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, cognito) }))
  const body = await response.json() as { username: string; session: null; codeDelivery: { destination: string } }
  assert.equal(response.status, 200)
  assert.equal(body.username, 'test@example.com')
  assert.equal(body.session, null)
  assert.equal(body.codeDelivery.destination, 'r***@e***')
})

test('POST /v1/auth/sign-up returns 400 for Cognito invalid input', async () => {
  const cognito = mockCognito({ signUp: async () => { throw cognitoError('InvalidParameterException') } })
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, cognito) }))
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT')
})

test('POST /v1/auth/sign-up returns 400 for an invalid email', async () => {
  const response = await request(createAuthApp((app) => { registerSignUpRoute(app, mockCognito()) }), 'not-an-email')
  const body = await response.json() as { code: string; message: string; requestId: string; retryable: boolean }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'INVALID_INPUT')
  assert.equal(body.message, '入力内容を確認してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})
