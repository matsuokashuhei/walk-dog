import * as SecureStore from 'expo-secure-store'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { setAuthenticationFailureHandler } from '@/lib/api'
import { createAuthSessionStore, type AuthSession } from '@/lib/auth-session-store'

const ACCESS_TOKEN_KEY = 'walkdog.accessToken'
const ID_TOKEN_KEY = 'walkdog.idToken'
const REFRESH_TOKEN_KEY = 'walkdog.refreshToken'

export type { AuthSession } from '@/lib/auth-session-store'

type AuthContextValue = {
  isReady: boolean
  session: AuthSession | null
  setSession: (session: AuthSession) => Promise<void>
  clearSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function readSession(): Promise<AuthSession | null> {
  const [accessToken, idToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(ID_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ])
  if (!accessToken || !idToken || !refreshToken) {
    return null
  }
  return { accessToken, idToken, refreshToken }
}

async function writeSession(session: AuthSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken),
    SecureStore.setItemAsync(ID_TOKEN_KEY, session.idToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken),
  ])
}

async function deleteSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(ID_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ])
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const [session, setSessionState] = useState<AuthSession | null>(null)
  const sessionStoreRef = useRef(createAuthSessionStore({ write: writeSession, clear: deleteSession }))

  useEffect(() => {
    let cancelled = false
    void readSession().then((stored) => {
      if (cancelled) {
        return
      }
      sessionStoreRef.current.hydrate(stored)
      setSessionState(stored)
      setIsReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setSession = async (next: AuthSession) => {
    if (await sessionStoreRef.current.set(next)) {
      setSessionState(next)
    }
  }

  const clearSession = useCallback(async () => {
    if (await sessionStoreRef.current.clear()) {
      setSessionState(null)
    }
  }, [])

  useEffect(() => {
    setAuthenticationFailureHandler((failedAccessToken) => {
      void sessionStoreRef.current.clearIfCurrentAccessToken(failedAccessToken).then((cleared) => {
        if (cleared) {
          setSessionState(null)
        }
      })
    })
    return () => {
      setAuthenticationFailureHandler(null)
    }
  }, [])

  return (
    <AuthContext value={{ isReady, session, setSession, clearSession }}>
      {children}
    </AuthContext>
  )
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return value
}
