export type AuthSession = {
  accessToken: string
  idToken: string
  refreshToken: string
}

type AuthSessionStorage = {
  write: (session: AuthSession) => Promise<void>
  clear: () => Promise<void>
}

export function createAuthSessionStore(storage: AuthSessionStorage, initial: AuthSession | null = null) {
  let session = initial
  let operations = Promise.resolve()

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const next = operations.then(operation)
    operations = next.catch(() => undefined)
    return next
  }

  return {
    current: () => session,
    hydrate: (next: AuthSession | null) => {
      session = next
    },
    set: async (next: AuthSession) => {
      session = next
      await enqueue(() => storage.write(next))
      return session === next
    },
    clear: async () => {
      session = null
      await enqueue(storage.clear)
      return session === null
    },
    clearIfCurrentAccessToken: async (accessToken: string) => {
      if (session?.accessToken !== accessToken) {
        return false
      }
      session = null
      await enqueue(storage.clear)
      return session === null
    },
  }
}
