import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthProvider } from '../../../../src/modules/auth/provider.js'
import { createVerifySignUp } from '../../../../src/modules/auth/use-cases/verify-sign-up.js'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: null,
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const authentication = {
  subject: 'test-cognito-sub',
  accessToken: 'mock-access-token',
  idToken: 'mock-id-token',
  refreshToken: 'mock-refresh-token',
}

function createFakes(handlers: {
  verifySignUp?: AuthProvider['verifySignUp']
  resolveByCognitoSubject?: OwnerRepository['resolveByCognitoSubject']
}): {
  provider: AuthProvider
  owners: OwnerRepository
  calls: string[]
} {
  const calls: string[] = []
  const provider: AuthProvider = {
    async signUp() {
      throw new Error('unexpected signUp')
    },
    async resendSignUpCode() {
      throw new Error('unexpected resendSignUpCode')
    },
    async startSignIn() {
      throw new Error('unexpected startSignIn')
    },
    async verifySignUp(input) {
      calls.push(`verifySignUp:${input.username}:${String(input.session)}:${input.code}`)
      if (!handlers.verifySignUp) {
        throw new Error('unexpected verifySignUp')
      }
      return handlers.verifySignUp(input)
    },
    async verifySignIn() {
      throw new Error('unexpected verifySignIn')
    },
    async signOut() {
      throw new Error('unexpected signOut')
    },
  }
  const owners: OwnerRepository = {
    async resolveByCognitoSubject(cognitoSubject) {
      calls.push(`resolveByCognitoSubject:${cognitoSubject}`)
      if (!handlers.resolveByCognitoSubject) {
        throw new Error(`unexpected resolveByCognitoSubject:${cognitoSubject}`)
      }
      return handlers.resolveByCognitoSubject(cognitoSubject)
    },
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }
  return { provider, owners, calls }
}

test('verifySignUp returns authenticated tokens and Owner', async () => {
  const { provider, owners, calls } = createFakes({
    verifySignUp: async () => ({ outcome: 'authenticated', authentication }),
    resolveByCognitoSubject: async () => owner,
  })
  const result = await createVerifySignUp(provider, owners)({
    username: 'test@example.com',
    session: 'test-session',
    code: '123456',
  })
  assert.deepEqual(result, {
    outcome: 'authenticated',
    authentication,
    owner,
  })
  assert.deepEqual(calls, [
    'verifySignUp:test@example.com:test-session:123456',
    'resolveByCognitoSubject:test-cognito-sub',
  ])
})

test('verifySignUp resolves Owner only from authentication.subject', async () => {
  const { provider, owners, calls } = createFakes({
    verifySignUp: async () => ({
      outcome: 'authenticated',
      authentication: { ...authentication, subject: 'subject-from-provider' },
    }),
    resolveByCognitoSubject: async () => owner,
  })
  await createVerifySignUp(provider, owners)({
    username: 'test@example.com',
    session: null,
    code: '123456',
  })
  assert.deepEqual(calls, [
    'verifySignUp:test@example.com:null:123456',
    'resolveByCognitoSubject:subject-from-provider',
  ])
})

const knownFailures = [
  'code-expired',
  'invalid-code',
  'code-already-used',
  'already-confirmed',
  'rate-limited',
  'incomplete-authentication',
] as const

for (const failure of knownFailures) {
  test(`verifySignUp short-circuits on ${failure} without Owner resolution`, async () => {
    const { provider, owners, calls } = createFakes({
      verifySignUp: async () => ({ outcome: failure }),
    })
    const result = await createVerifySignUp(provider, owners)({
      username: 'test@example.com',
      session: 'test-session',
      code: '000000',
    })
    assert.deepEqual(result, { outcome: failure })
    assert.deepEqual(calls, ['verifySignUp:test@example.com:test-session:000000'])
  })
}

test('verifySignUp propagates unexpected provider errors by identity', async () => {
  const unexpected = new Error('verify sign-up boom')
  const { provider, owners, calls } = createFakes({
    verifySignUp: async () => {
      throw unexpected
    },
  })
  await assert.rejects(
    () => createVerifySignUp(provider, owners)({
      username: 'test@example.com',
      session: 'test-session',
      code: '123456',
    }),
    (error: unknown) => error === unexpected,
  )
  assert.deepEqual(calls, ['verifySignUp:test@example.com:test-session:123456'])
})

test('verifySignUp propagates unexpected Owner errors by identity', async () => {
  const unexpected = new Error('owner boom')
  const { provider, owners, calls } = createFakes({
    verifySignUp: async () => ({ outcome: 'authenticated', authentication }),
    resolveByCognitoSubject: async () => {
      throw unexpected
    },
  })
  await assert.rejects(
    () => createVerifySignUp(provider, owners)({
      username: 'test@example.com',
      session: 'test-session',
      code: '123456',
    }),
    (error: unknown) => error === unexpected,
  )
  assert.deepEqual(calls, [
    'verifySignUp:test@example.com:test-session:123456',
    'resolveByCognitoSubject:test-cognito-sub',
  ])
})
