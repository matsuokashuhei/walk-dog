import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSignInVerifyRoute } from '../src/routes/sign-in-verify.js'
import { cognitoError, createAuthApp, mockCognito, mockDb } from './auth-fixtures.js'

const request = (app: ReturnType<typeof createAuthApp>) => app.request('/v1/auth/sign-in/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }) })

test('POST /v1/auth/sign-in/verify returns 400 for an empty OTP', async () => {
  const app = createAuthApp((routeApp) => { registerSignInVerifyRoute(routeApp, mockDb(), mockCognito()) })
  const response = await app.request('/v1/auth/sign-in/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@example.com', session: 'sign-in-session', code: '' }) })
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT')
})

test('POST /v1/auth/sign-in/verify returns tokens for a valid OTP', async () => {
  const response = await request(createAuthApp((app) => { registerSignInVerifyRoute(app, mockDb(), mockCognito()) }))
  const body = await response.json() as { accessToken: string; owner: { ownerId: string } }
  assert.equal(response.status, 200)
  assert.equal(body.accessToken, 'mock-access')
  assert.equal(body.owner.ownerId, '019fc312-f7eb-73c4-9351-2a6ea25e4fcb')
})

test('POST /v1/auth/sign-in/verify returns CODE_EXPIRED for an expired OTP', async () => {
  const cognito = mockCognito({ respondToAuthChallenge: async () => { throw cognitoError('ExpiredCodeException') } })
  const response = await request(createAuthApp((app) => { registerSignInVerifyRoute(app, mockDb(), cognito) }))
  const body = await response.json() as { code: string; message: string }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'CODE_EXPIRED')
  assert.equal(body.message, 'コードの有効期限が切れました。コードを再送してください。')
})

test('POST /v1/auth/sign-in/verify tells the user to resend after an invalid challenge session', async () => {
  const cognito = mockCognito({ respondToAuthChallenge: async () => { throw cognitoError('NotAuthorizedException') } })
  const response = await request(createAuthApp((app) => { registerSignInVerifyRoute(app, mockDb(), cognito) }))
  const body = await response.json() as { code: string; message: string }
  assert.equal(response.status, 409)
  assert.equal(body.code, 'AUTHENTICATION_FAILED')
  assert.equal(body.message, '認証情報の有効期限が切れました。コードを再送してください。')
})
