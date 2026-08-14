import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthProvider } from '../../../../src/modules/auth/provider.js'
import { createSignOut } from '../../../../src/modules/auth/use-cases/sign-out.js'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'
import type { ActiveWalkCommands } from '../../../../src/modules/walks/active-walk-commands.js'

const owner: Owner = {
  ownerId: 'owner-1',
  displayName: null,
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

function createFakes(handlers: {
  resolveByCognitoSubject?: OwnerRepository['resolveByCognitoSubject']
  failIfPresent?: ActiveWalkCommands['failIfPresent']
  signOut?: AuthProvider['signOut']
}): {
  owners: OwnerRepository
  activeWalkCommands: ActiveWalkCommands
  provider: AuthProvider
  calls: string[]
} {
  const calls: string[] = []
  const owners: OwnerRepository = {
    async resolveByCognitoSubject(cognitoSubject) {
      calls.push(`resolve:${cognitoSubject}`)
      if (!handlers.resolveByCognitoSubject) {
        throw new Error(`unexpected resolveByCognitoSubject:${cognitoSubject}`)
      }
      return handlers.resolveByCognitoSubject(cognitoSubject)
    },
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }
  const activeWalkCommands: ActiveWalkCommands = {
    async failIfPresent(input) {
      calls.push(`fail:${input.ownerId}`)
      if (!handlers.failIfPresent) {
        throw new Error(`unexpected failIfPresent:${input.ownerId}`)
      }
      return handlers.failIfPresent(input)
    },
  }
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
    async verifySignIn() {
      throw new Error('unexpected verifySignIn')
    },
    async signOut(accessToken) {
      calls.push(`cognito:${accessToken}`)
      if (!handlers.signOut) {
        throw new Error(`unexpected signOut:${accessToken}`)
      }
      return handlers.signOut(accessToken)
    },
  }
  return { owners, activeWalkCommands, provider, calls }
}

test('fails Active Walk then signs out Cognito', async () => {
  const calls: string[] = []
  const signOut = createSignOut(
    {
      resolveByCognitoSubject: async () => owner,
    },
    {
      failIfPresent: async ({ ownerId }) => {
        assert.equal(ownerId, 'owner-1')
        calls.push('fail')
      },
    },
    {
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
      async verifySignIn() {
        throw new Error('unexpected verifySignIn')
      },
      signOut: async (token) => {
        assert.equal(token, 'access')
        calls.push('cognito')
        return { outcome: 'signed-out' }
      },
    },
  )
  assert.deepEqual(
    await signOut({ cognitoSubject: 'sub-1', accessToken: 'access' }),
    { outcome: 'signed-out' },
  )
  assert.deepEqual(calls, ['fail', 'cognito'])
})

test('resolves Owner before failing Active Walk', async () => {
  const { owners, activeWalkCommands, provider, calls } = createFakes({
    resolveByCognitoSubject: async () => owner,
    failIfPresent: async () => {},
    signOut: async () => ({ outcome: 'signed-out' }),
  })
  await createSignOut(owners, activeWalkCommands, provider)({
    cognitoSubject: 'sub-1',
    accessToken: 'access',
  })
  assert.deepEqual(calls, ['resolve:sub-1', 'fail:owner-1', 'cognito:access'])
})

test('returns authentication-failed from Cognito without changing order', async () => {
  const { owners, activeWalkCommands, provider, calls } = createFakes({
    resolveByCognitoSubject: async () => owner,
    failIfPresent: async () => {},
    signOut: async () => ({ outcome: 'authentication-failed' }),
  })
  assert.deepEqual(
    await createSignOut(owners, activeWalkCommands, provider)({
      cognitoSubject: 'sub-1',
      accessToken: 'access',
    }),
    { outcome: 'authentication-failed' },
  )
  assert.deepEqual(calls, ['resolve:sub-1', 'fail:owner-1', 'cognito:access'])
})

test('returns rate-limited from Cognito', async () => {
  const { owners, activeWalkCommands, provider, calls } = createFakes({
    resolveByCognitoSubject: async () => owner,
    failIfPresent: async () => {},
    signOut: async () => ({ outcome: 'rate-limited' }),
  })
  assert.deepEqual(
    await createSignOut(owners, activeWalkCommands, provider)({
      cognitoSubject: 'sub-1',
      accessToken: 'access',
    }),
    { outcome: 'rate-limited' },
  )
  assert.deepEqual(calls, ['resolve:sub-1', 'fail:owner-1', 'cognito:access'])
})

test('does not call Cognito when Active Walk failIfPresent throws', async () => {
  const failure = new Error('active walk failure')
  const { owners, activeWalkCommands, provider, calls } = createFakes({
    resolveByCognitoSubject: async () => owner,
    failIfPresent: async () => {
      throw failure
    },
    signOut: async () => ({ outcome: 'signed-out' }),
  })
  await assert.rejects(
    () => createSignOut(owners, activeWalkCommands, provider)({
      cognitoSubject: 'sub-1',
      accessToken: 'access',
    }),
    (error: unknown) => error === failure,
  )
  assert.deepEqual(calls, ['resolve:sub-1', 'fail:owner-1'])
})

test('propagates unexpected Cognito errors by identity', async () => {
  const failure = new Error('cognito exploded')
  const { owners, activeWalkCommands, provider } = createFakes({
    resolveByCognitoSubject: async () => owner,
    failIfPresent: async () => {},
    signOut: async () => {
      throw failure
    },
  })
  await assert.rejects(
    () => createSignOut(owners, activeWalkCommands, provider)({
      cognitoSubject: 'sub-1',
      accessToken: 'access',
    }),
    (error: unknown) => error === failure,
  )
})
