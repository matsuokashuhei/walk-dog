import type { App } from '../src/app.js'
import { createApp } from '../src/app.js'
import type { CognitoClient } from '../src/auth/cognito.js'
import type { DbInstance } from '../src/db/client.js'
import { setRequestIdTag } from '../src/observability/sentry.js'
import { testLogger } from './test-logger.js'

const appDependencies = { logger: testLogger, setRequestId: setRequestIdTag }

export function makeIdToken(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64')
  return `header.${payload}.signature`
}

export function createAuthApp(registerRoutes: (app: App) => void): App {
  return createApp(appDependencies, registerRoutes)
}

export function cognitoError(name: string): Error {
  return Object.assign(new Error(), { name })
}

export function mockCognito(overrides: Partial<CognitoClient> = {}): CognitoClient {
  return {
    client: {} as CognitoClient['client'],
    signUp: async () => ({ UserSub: 'test-sub', Session: 'test-session', CodeDeliveryDetails: { Destination: 't***@t***', AttributeName: 'email' }, $metadata: {} }),
    confirmSignUp: async () => ({ Session: 'confirmed-session', $metadata: {} }),
    resendConfirmationCode: async () => ({ CodeDeliveryDetails: { Destination: 't***@t***', AttributeName: 'email' }, $metadata: {} }),
    adminGetUser: async () => ({ UserStatus: 'CONFIRMED', Enabled: true, $metadata: {} }),
    initiateAuth: async () => ({ AuthenticationResult: { AccessToken: 'mock-access-token', IdToken: makeIdToken('test-cognito-sub'), RefreshToken: 'mock-refresh-token' }, $metadata: {} }),
    respondToAuthChallenge: async () => ({ AuthenticationResult: { AccessToken: 'mock-access', IdToken: makeIdToken('test-cognito-sub'), RefreshToken: 'mock-refresh' }, $metadata: {} }),
    ...overrides,
  }
}

export function mockDb(): DbInstance {
  const owner = { ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb', cognitoSubject: 'test-cognito-sub', displayName: null, createdAt: new Date('2026-08-02T15:23:48.068Z'), updatedAt: new Date('2026-08-02T15:23:48.068Z') }
  const returning = async () => [owner]
  const onConflictDoNothing = () => ({ returning })
  const insertValues = () => ({ onConflictDoNothing })
  const insert = () => ({ values: insertValues })
  const limitWithOwner = async () => [owner]
  const whereWithOwner = () => ({ limit: limitWithOwner })
  const fromWithOwner = () => ({ where: whereWithOwner })
  const selectWithOwner = () => ({ from: fromWithOwner })
  const transaction = { insert, select: selectWithOwner }
  const limitEmpty = async () => []
  const whereEmpty = () => ({ limit: limitEmpty })
  const fromEmpty = () => ({ where: whereEmpty })
  const selectEmpty = () => ({ from: fromEmpty })
  return {
    insert,
    select: selectEmpty,
    transaction: async (callback: (database: typeof transaction) => Promise<unknown>) => callback(transaction),
  } as unknown as DbInstance
}
