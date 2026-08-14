import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthProvider } from '../../../../src/modules/auth/provider.js'
import { createVerifySignIn } from '../../../../src/modules/auth/use-cases/verify-sign-in.js'
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
  accessToken: 'mock-access',
  idToken: 'mock-id',
  refreshToken: 'mock-refresh',
}

function createFakes(handlers: {
  verifySignIn?: AuthProvider['verifySignIn']
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
    async verifySignUp() {
      throw new Error('unexpected verifySignUp')
    },
    async verifySignIn(input) {
      calls.push(`verifySignIn:${input.username}:${input.session}:${input.code}`)
      if (!handlers.verifySignIn) {
        throw new Error('unexpected verifySignIn')
      }
      return handlers.verifySignIn(input)
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

test('verifySignIn returns authenticated tokens and Owner', async () => {
  const { provider, owners, calls } = createFakes({
    verifySignIn: async () => ({ outcome: 'authenticated', authentication }),
    resolveByCognitoSubject: async () => owner,
  })
  const result = await createVerifySignIn(provider, owners)({
    username: 'test@example.com',
    session: 'sign-in-session',
    code: '12345678',
  })
  assert.deepEqual(result, {
    outcome: 'authenticated',
    authentication,
    owner,
  })
  assert.deepEqual(calls, [
    'verifySignIn:test@example.com:sign-in-session:12345678',
    'resolveByCognitoSubject:test-cognito-sub',
  ])
})

test('verifySignIn resolves Owner only from authentication.subject', async () => {
  const { provider, owners, calls } = createFakes({
    verifySignIn: async () => ({
      outcome: 'authenticated',
      authentication: { ...authentication, subject: 'subject-from-provider' },
    }),
    resolveByCognitoSubject: async () => owner,
  })
  await createVerifySignIn(provider, owners)({
    username: 'test@example.com',
    session: 'sign-in-session',
    code: '12345678',
  })
  assert.deepEqual(calls, [
    'verifySignIn:test@example.com:sign-in-session:12345678',
    'resolveByCognitoSubject:subject-from-provider',
  ])
})

const knownFailures = [
  'code-expired',
  'invalid-code',
  'code-already-used',
  'authentication-failed',
  'rate-limited',
  'incomplete-authentication',
] as const

for (const failure of knownFailures) {
  test(`verifySignIn short-circuits on ${failure} without Owner resolution`, async () => {
    const { provider, owners, calls } = createFakes({
      verifySignIn: async () => ({ outcome: failure }),
    })
    const result = await createVerifySignIn(provider, owners)({
      username: 'test@example.com',
      session: 'sign-in-session',
      code: '00000000',
    })
    assert.deepEqual(result, { outcome: failure })
    assert.deepEqual(calls, ['verifySignIn:test@example.com:sign-in-session:00000000'])
  })
}

test('verifySignIn propagates unexpected provider errors by identity', async () => {
  const unexpected = new Error('verify sign-in boom')
  const { provider, owners, calls } = createFakes({
    verifySignIn: async () => {
      throw unexpected
    },
  })
  await assert.rejects(
    () => createVerifySignIn(provider, owners)({
      username: 'test@example.com',
      session: 'sign-in-session',
      code: '12345678',
    }),
    (error: unknown) => error === unexpected,
  )
  assert.deepEqual(calls, ['verifySignIn:test@example.com:sign-in-session:12345678'])
})

test('verifySignIn propagates unexpected Owner errors by identity', async () => {
  const unexpected = new Error('owner boom')
  const { provider, owners, calls } = createFakes({
    verifySignIn: async () => ({ outcome: 'authenticated', authentication }),
    resolveByCognitoSubject: async () => {
      throw unexpected
    },
  })
  await assert.rejects(
    () => createVerifySignIn(provider, owners)({
      username: 'test@example.com',
      session: 'sign-in-session',
      code: '12345678',
    }),
    (error: unknown) => error === unexpected,
  )
  assert.deepEqual(calls, [
    'verifySignIn:test@example.com:sign-in-session:12345678',
    'resolveByCognitoSubject:test-cognito-sub',
  ])
})
