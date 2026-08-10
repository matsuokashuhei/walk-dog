import assert from 'node:assert/strict'
import test from 'node:test'
import { registerSignInRoute } from '../src/routes/sign-in.js'
import { cognitoError, createAuthApp, mockCognito } from './auth-fixtures.js'

const request = (app: ReturnType<typeof createAuthApp>) => app.request('/v1/auth/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.com' }) })

test('POST /v1/auth/sign-in returns 400 for an invalid email', async () => {
  const app = createAuthApp((routeApp) => { registerSignInRoute(routeApp, mockCognito()) })
  const response = await app.request('/v1/auth/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email' }) })
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT')
})

test('POST /v1/auth/sign-in returns an email OTP challenge', async () => {
  const cognito = mockCognito({ initiateAuth: async () => ({ ChallengeName: 'EMAIL_OTP', Session: 'sign-in-session', ChallengeParameters: { CODE_DELIVERY_DESTINATION: 't***@t***' }, $metadata: {} }) })
  const response = await request(createAuthApp((app) => { registerSignInRoute(app, cognito) }))
  const body = await response.json() as { username: string; session: string; codeDelivery: { destination: string; attribute: string } }
  assert.equal(response.status, 200)
  assert.equal(body.username, 'test@example.com')
  assert.equal(body.session, 'sign-in-session')
  assert.equal(body.codeDelivery.destination, 't***@t***')
  assert.equal(body.codeDelivery.attribute, 'email')
})

test('POST /v1/auth/sign-in returns 429 when Cognito rate limits the challenge', async () => {
  const cognito = mockCognito({ initiateAuth: async () => { throw cognitoError('TooManyRequestsException') } })
  const response = await request(createAuthApp((app) => { registerSignInRoute(app, cognito) }))
  assert.equal(response.status, 429)
  assert.equal((await response.json() as { code: string }).code, 'RATE_LIMITED')
})
