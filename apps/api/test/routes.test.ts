/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion, sonarjs/no-nested-functions, id-length */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { setRequestIdTag } from '../src/observability/sentry.js'
import { testLogger } from './test-logger.js'
import { registerAuthRoutes, type CognitoClient } from '../src/routes/auth.js'
import type { DbInstance } from '../src/db/client.js'

const appDependencies = {
  logger: testLogger,
  setRequestId: setRequestIdTag,
}

function makeIdToken(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64')
  return `header.${payload}.signature`
}

function mockCognito(overrides: Partial<CognitoClient> = {}): CognitoClient {
  return {
    client: {} as any,
    signUp: async () => ({ UserSub: 'test-sub', Session: 'test-session', CodeDeliveryDetails: { Destination: 't***@t***', AttributeName: 'email' }, $metadata: {} }),
    confirmSignUp: async () => ({ Session: 'confirmed-session', $metadata: {} }),
    resendConfirmationCode: async () => ({ CodeDeliveryDetails: { Destination: 't***@t***', AttributeName: 'email' }, $metadata: {} }),
    adminGetUser: async () => ({ UserStatus: 'CONFIRMED', Enabled: true, $metadata: {} }),
    initiateAuth: async () => ({
      AuthenticationResult: {
        AccessToken: 'mock-access-token',
        IdToken: makeIdToken('test-cognito-sub'),
        RefreshToken: 'mock-refresh-token',
      },
      $metadata: {},
    }),
    respondToAuthChallenge: async () => ({ AuthenticationResult: { AccessToken: 'mock-access', IdToken: makeIdToken('test-cognito-sub'), RefreshToken: 'mock-refresh' }, $metadata: {} }),
    ...overrides,
  }
}

function mockDb(): DbInstance {
  const ownerRecord = {
    ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
    cognitoSubject: 'test-cognito-sub',
    displayName: null,
    createdAt: new Date('2026-08-02T15:23:48.068Z'),
    updatedAt: new Date('2026-08-02T15:23:48.068Z'),
  }

  async function returningResult() { return [ownerRecord] }

  return {
    insert: () => ({ values: () => ({ onConflictDoNothing: () => ({ returning: returningResult }) }) }),
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    transaction: async (fn: any) => fn({
      insert: () => ({ values: () => ({ onConflictDoNothing: () => ({ returning: returningResult }) }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([ownerRecord]) }) }) }),
    }),
  } as unknown as DbInstance
}

test('POST /v1/auth/sign-up returns 200 with session for valid email', async () => {
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), mockCognito())
  })

  const response = await app.request('/v1/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com' }),
  })

  assert.equal(response.status, 200)
  const body = await response.json() as any
  assert.ok(body.requestId)
  assert.equal(body.username, 'test@example.com')
  assert.equal(body.session, 'test-session')
  assert.equal(body.codeDelivery.destination, 't***@t***')
})

test('POST /v1/auth/sign-up returns 409 for existing confirmed user', async () => {
  const cognito = mockCognito({
    signUp: async () => { throw Object.assign(new Error(), { name: 'UsernameExistsException' }) },
    resendConfirmationCode: async () => {
      throw Object.assign(new Error('User is already confirmed.'), { name: 'InvalidParameterException' })
    },
  })
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), cognito)
  })

  const response = await app.request('/v1/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com' }),
  })

  assert.equal(response.status, 409)
  const body = await response.json() as any
  assert.equal(body.code, 'AUTHENTICATION_FAILED')
})

test('POST /v1/auth/sign-up resends OTP for existing unconfirmed user', async () => {
  const cognito = mockCognito({
    signUp: async () => { throw Object.assign(new Error(), { name: 'UsernameExistsException' }) },
    resendConfirmationCode: async () => ({
      CodeDeliveryDetails: { Destination: 'r***@e***', AttributeName: 'email' },
      $metadata: {},
    }),
  })
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), cognito)
  })

  const response = await app.request('/v1/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com' }),
  })

  assert.equal(response.status, 200)
  const body = await response.json() as any
  assert.equal(body.username, 'test@example.com')
  assert.equal(body.session, null)
  assert.equal(body.codeDelivery.destination, 'r***@e***')
})

test('POST /v1/auth/sign-up returns 400 for Cognito InvalidParameterException', async () => {
  const cognito = mockCognito({
    signUp: async () => { throw Object.assign(new Error(), { name: 'InvalidParameterException' }) },
  })
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), cognito)
  })

  const response = await app.request('/v1/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com' }),
  })

  const body = await response.json() as any
  assert.equal(response.status, 400)
  assert.equal(body.code, 'INVALID_INPUT')
})

test('POST /v1/auth/sign-up returns 400 for format validation error', async () => {
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), mockCognito())
  })

  const response = await app.request('/v1/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' }),
  })

  const body = await response.json() as {
    code: string
    message: string
    requestId: string
    retryable: boolean
  }
  assert.equal(response.status, 400)
  assert.equal(body.code, 'INVALID_INPUT')
  assert.equal(body.message, '入力内容を確認してください。')
  assert.equal(typeof body.requestId, 'string')
  assert.equal(body.requestId.length > 0, true)
  assert.equal(body.retryable, false)
})

test('POST /v1/auth/verify returns 200 with tokens for valid code', async () => {
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), mockCognito())
  })

  const response = await app.request('/v1/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test@example.com', session: 'test-session', code: '123456' }),
  })

  assert.equal(response.status, 200)
  const body = await response.json() as any
  assert.ok(body.requestId)
  assert.equal(body.accessToken, 'mock-access-token')
  assert.ok(body.idToken)
  assert.equal(body.refreshToken, 'mock-refresh-token')
  assert.ok(body.owner.ownerId)
  assert.equal(body.owner.displayName, null)
})

test('POST /v1/auth/verify returns 400 for invalid code', async () => {
  const cognito = mockCognito({
    confirmSignUp: async () => { throw Object.assign(new Error(), { name: 'CodeMismatchException' }) },
  })
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), cognito)
  })

  const response = await app.request('/v1/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test@example.com', session: 'test-session', code: '000000' }),
  })

  assert.equal(response.status, 400)
  const body = await response.json() as any
  assert.equal(body.code, 'INVALID_CODE')
})

test('POST /v1/auth/verify returns 409 for already confirmed user', async () => {
  const cognito = mockCognito({
    confirmSignUp: async () => { throw Object.assign(new Error(), { name: 'NotAuthorizedException' }) },
  })
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), cognito)
  })

  const response = await app.request('/v1/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test@example.com', session: 'test-session', code: '000000' }),
  })

  assert.equal(response.status, 409)
  const body = await response.json() as any
  assert.equal(body.code, 'AUTHENTICATION_FAILED')
})

test('POST /v1/auth/sign-in returns an email OTP challenge', async () => {
  const cognito = mockCognito({
    initiateAuth: async () => ({
      ChallengeName: 'EMAIL_OTP',
      Session: 'sign-in-session',
      ChallengeParameters: { CODE_DELIVERY_DESTINATION: 't***@t***' },
      $metadata: {},
    }),
  })
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), cognito)
  })

  const response = await app.request('/v1/auth/sign-in', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.com' }),
  })

  assert.equal(response.status, 200)
  const body = await response.json() as any
  assert.equal(body.username, 'test@example.com')
  assert.equal(body.session, 'sign-in-session')
  assert.equal(body.codeDelivery.destination, 't***@t***')
  assert.equal(body.codeDelivery.attribute, 'email')
})

test('POST /v1/auth/sign-in/verify returns tokens for a valid OTP', async () => {
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), mockCognito())
  })

  const response = await app.request('/v1/auth/sign-in/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }),
  })

  assert.equal(response.status, 200)
  const body = await response.json() as any
  assert.equal(body.accessToken, 'mock-access')
  assert.equal(body.owner.ownerId, '019fc312-f7eb-73c4-9351-2a6ea25e4fcb')
})

test('POST /v1/auth/sign-in/verify returns CODE_EXPIRED for an expired OTP', async () => {
  const cognito = mockCognito({
    respondToAuthChallenge: async () => { throw Object.assign(new Error(), { name: 'ExpiredCodeException' }) },
  })
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), cognito)
  })

  const response = await app.request('/v1/auth/sign-in/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }),
  })

  assert.equal(response.status, 400)
  const body = await response.json() as any
  assert.equal(body.code, 'CODE_EXPIRED')
  assert.equal(body.message, 'コードの有効期限が切れました。コードを再送してください。')
})

test('POST /v1/auth/sign-in returns 429 when Cognito rate limits the challenge', async () => {
  const cognito = mockCognito({
    initiateAuth: async () => { throw Object.assign(new Error(), { name: 'TooManyRequestsException' }) },
  })
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), cognito)
  })
  const response = await app.request('/v1/auth/sign-in', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.com' }),
  })
  assert.equal(response.status, 429)
  assert.equal((await response.json() as any).code, 'RATE_LIMITED')
})

test('POST /v1/auth/sign-in/verify tells the user to resend after an invalid challenge session', async () => {
  const cognito = mockCognito({
    respondToAuthChallenge: async () => { throw Object.assign(new Error(), { name: 'NotAuthorizedException' }) },
  })
  const app = createApp(appDependencies, (application) => {
    registerAuthRoutes(application, mockDb(), cognito)
  })
  const response = await app.request('/v1/auth/sign-in/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test@example.com', session: 'sign-in-session', code: '12345678' }),
  })
  assert.equal(response.status, 409)
  const body = await response.json() as any
  assert.equal(body.code, 'AUTHENTICATION_FAILED')
  assert.equal(body.message, '認証情報の有効期限が切れました。コードを再送してください。')
})
