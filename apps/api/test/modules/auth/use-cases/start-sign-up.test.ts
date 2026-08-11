import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthProvider } from '../../../../src/modules/auth/provider.js'
import { createStartSignUp } from '../../../../src/modules/auth/use-cases/start-sign-up.js'

function createProviderFake(handlers: Partial<AuthProvider>): {
  provider: AuthProvider
  calls: string[]
} {
  const calls: string[] = []
  const provider: AuthProvider = {
    async signUp(email) {
      calls.push(`signUp:${email}`)
      if (!handlers.signUp) {
        throw new Error(`unexpected signUp:${email}`)
      }
      return handlers.signUp(email)
    },
    async resendSignUpCode(email) {
      calls.push(`resendSignUpCode:${email}`)
      if (!handlers.resendSignUpCode) {
        throw new Error(`unexpected resendSignUpCode:${email}`)
      }
      return handlers.resendSignUpCode(email)
    },
    async startSignIn(email, session) {
      calls.push(`startSignIn:${email}:${session ?? ''}`)
      if (!handlers.startSignIn) {
        throw new Error(`unexpected startSignIn:${email}`)
      }
      return handlers.startSignIn(email, session)
    },
  }
  return { provider, calls }
}

test('startSignUp returns a challenge from a direct sign-up', async () => {
  const { provider, calls } = createProviderFake({
    signUp: async () => ({
      outcome: 'signed-up',
      session: 'test-session',
      codeDelivery: { destination: 't***@t***', attribute: 'email' },
    }),
  })
  const result = await createStartSignUp(provider)({ email: 'test@example.com' })
  assert.deepEqual(result, {
    outcome: 'challenge',
    username: 'test@example.com',
    session: 'test-session',
    codeDelivery: { destination: 't***@t***', attribute: 'email' },
  })
  assert.deepEqual(calls, ['signUp:test@example.com'])
})

test('startSignUp resends a code when the username already exists', async () => {
  const { provider, calls } = createProviderFake({
    signUp: async () => ({ outcome: 'username-exists' }),
    resendSignUpCode: async () => ({
      outcome: 'code-sent',
      codeDelivery: { destination: 'r***@e***', attribute: 'email' },
    }),
  })
  const result = await createStartSignUp(provider)({ email: 'test@example.com' })
  assert.deepEqual(result, {
    outcome: 'challenge',
    username: 'test@example.com',
    session: null,
    codeDelivery: { destination: 'r***@e***', attribute: 'email' },
  })
  assert.deepEqual(calls, [
    'signUp:test@example.com',
    'resendSignUpCode:test@example.com',
  ])
})

test('startSignUp returns already-confirmed when resend reports a confirmed user', async () => {
  const { provider, calls } = createProviderFake({
    signUp: async () => ({ outcome: 'username-exists' }),
    resendSignUpCode: async () => ({ outcome: 'already-confirmed' }),
  })
  const result = await createStartSignUp(provider)({ email: 'test@example.com' })
  assert.deepEqual(result, { outcome: 'already-confirmed' })
  assert.deepEqual(calls, [
    'signUp:test@example.com',
    'resendSignUpCode:test@example.com',
  ])
})

test('startSignUp returns invalid-input from sign-up', async () => {
  const { provider, calls } = createProviderFake({
    signUp: async () => ({ outcome: 'invalid-input' }),
  })
  const result = await createStartSignUp(provider)({ email: 'test@example.com' })
  assert.deepEqual(result, { outcome: 'invalid-input' })
  assert.deepEqual(calls, ['signUp:test@example.com'])
})

test('startSignUp returns rate-limited from sign-up', async () => {
  const { provider, calls } = createProviderFake({
    signUp: async () => ({ outcome: 'rate-limited' }),
  })
  const result = await createStartSignUp(provider)({ email: 'test@example.com' })
  assert.deepEqual(result, { outcome: 'rate-limited' })
  assert.deepEqual(calls, ['signUp:test@example.com'])
})

test('startSignUp returns rate-limited from resend', async () => {
  const { provider, calls } = createProviderFake({
    signUp: async () => ({ outcome: 'username-exists' }),
    resendSignUpCode: async () => ({ outcome: 'rate-limited' }),
  })
  const result = await createStartSignUp(provider)({ email: 'test@example.com' })
  assert.deepEqual(result, { outcome: 'rate-limited' })
  assert.deepEqual(calls, [
    'signUp:test@example.com',
    'resendSignUpCode:test@example.com',
  ])
})

test('startSignUp propagates unexpected sign-up errors by identity', async () => {
  const unexpected = new Error('sign-up boom')
  const { provider } = createProviderFake({
    signUp: async () => {
      throw unexpected
    },
  })
  await assert.rejects(
    () => createStartSignUp(provider)({ email: 'test@example.com' }),
    (error: unknown) => error === unexpected,
  )
})

test('startSignUp propagates unexpected resend errors by identity', async () => {
  const unexpected = new Error('resend boom')
  const { provider, calls } = createProviderFake({
    signUp: async () => ({ outcome: 'username-exists' }),
    resendSignUpCode: async () => {
      throw unexpected
    },
  })
  await assert.rejects(
    () => createStartSignUp(provider)({ email: 'test@example.com' }),
    (error: unknown) => error === unexpected,
  )
  assert.deepEqual(calls, [
    'signUp:test@example.com',
    'resendSignUpCode:test@example.com',
  ])
})
