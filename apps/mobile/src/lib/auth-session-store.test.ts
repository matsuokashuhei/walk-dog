import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthSessionStore, type AuthSession } from './auth-session-store.ts'

const previousSession: AuthSession = {
  accessToken: 'access-token-a',
  idToken: 'id-token-a',
  refreshToken: 'refresh-token-a',
}

const nextSession: AuthSession = {
  accessToken: 'access-token-b',
  idToken: 'id-token-b',
  refreshToken: 'refresh-token-b',
}

test('keeps a new session when an earlier token expires during persistence', async () => {
  const writes: AuthSession[] = []
  let releaseWrite: (() => void) | undefined
  const store = createAuthSessionStore(
    {
      write: async (session) => {
        writes.push(session)
        await new Promise<void>((resolve) => {
          releaseWrite = resolve
        })
      },
      clear: async () => {
        throw new Error('clear must not run')
      },
    },
    previousSession,
  )

  const persist = store.set(nextSession)
  const cleared = store.clearIfCurrentAccessToken(previousSession.accessToken)

  assert.equal(await cleared, false)
  assert.equal(store.current(), nextSession)
  releaseWrite?.()
  assert.equal(await persist, true)
  assert.deepEqual(writes, [nextSession])
})
