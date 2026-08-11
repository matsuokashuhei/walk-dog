import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthProvider } from '../../../../src/modules/auth/provider.js'
import { createStartSignIn } from '../../../../src/modules/auth/use-cases/start-sign-in.js'

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

test('startSignIn returns an EMAIL_OTP challenge', async () => {
  const { provider, calls } = createProviderFake({
    startSignIn: async () => ({
      outcome: 'challenge',
      session: 'sign-in-session',
      codeDelivery: { destination: 't***@t***', attribute: 'email' },
    }),
  })
  const result = await createStartSignIn(provider)({ email: 'test@example.com' })
  assert.deepEqual(result, {
    outcome: 'challenge',
    username: 'test@example.com',
    session: 'sign-in-session',
    codeDelivery: { destination: 't***@t***', attribute: 'email' },
  })
  assert.deepEqual(calls, ['startSignIn:test@example.com:'])
})

test('startSignIn returns authentication-failed', async () => {
  const { provider, calls } = createProviderFake({
    startSignIn: async () => ({ outcome: 'authentication-failed' }),
  })
  const result = await createStartSignIn(provider)({ email: 'test@example.com' })
  assert.deepEqual(result, { outcome: 'authentication-failed' })
  assert.deepEqual(calls, ['startSignIn:test@example.com:'])
})

test('startSignIn returns rate-limited', async () => {
  const { provider, calls } = createProviderFake({
    startSignIn: async () => ({ outcome: 'rate-limited' }),
  })
  const result = await createStartSignIn(provider)({ email: 'test@example.com' })
  assert.deepEqual(result, { outcome: 'rate-limited' })
  assert.deepEqual(calls, ['startSignIn:test@example.com:'])
})

test('startSignIn returns incomplete-challenge as an internal failure', async () => {
  const { provider, calls } = createProviderFake({
    startSignIn: async () => ({ outcome: 'incomplete-challenge' }),
  })
  const result = await createStartSignIn(provider)({ email: 'test@example.com' })
  assert.deepEqual(result, { outcome: 'incomplete-challenge' })
  assert.deepEqual(calls, ['startSignIn:test@example.com:'])
})

test('startSignIn propagates unexpected errors by identity', async () => {
  const unexpected = new Error('sign-in boom')
  const { provider } = createProviderFake({
    startSignIn: async () => {
      throw unexpected
    },
  })
  await assert.rejects(
    () => createStartSignIn(provider)({ email: 'test@example.com' }),
    (error: unknown) => error === unexpected,
  )
})
