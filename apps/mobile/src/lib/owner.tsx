import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { getOwner, updateOwnerDisplayName, type OwnerResponse } from '@/lib/owner-api'

type OwnerContextValue = {
  isReady: boolean
  owner: OwnerResponse | null
  loadError: string | null
  reload: () => void
  updateDisplayName: (displayName: string) => Promise<void>
}

const OwnerContext = createContext<OwnerContextValue | null>(null)

export function OwnerProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [isReady, setIsReady] = useState(false)
  const [owner, setOwner] = useState<OwnerResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const reload = useCallback(() => {
    if (!session) {
      throw new Error('OwnerProvider requires an authenticated session')
    }
    setIsReady(false)
    setLoadError(null)
    void getOwner(session.accessToken)
      .then((next) => {
        setOwner(next)
        setIsReady(true)
      })
      .catch((error) => {
        setLoadError(
          error instanceof ApiError
            ? error.message
            : '取得に失敗しました。再試行してください。',
        )
        setIsReady(true)
      })
  }, [session])

  useEffect(() => {
    if (!session) {
      return
    }
    reload()
  }, [reload, session])

  const updateDisplayName = async (displayName: string) => {
    if (!session) {
      throw new Error('OwnerProvider requires an authenticated session')
    }
    const next = await updateOwnerDisplayName(session.accessToken, displayName)
    setOwner(next)
  }

  if (!session) {
    return null
  }

  return (
    <OwnerContext
      value={{ isReady, owner, loadError, reload, updateDisplayName }}
    >
      {children}
    </OwnerContext>
  )
}

export function useOwner(): OwnerContextValue {
  const value = use(OwnerContext)
  if (!value) {
    throw new Error('useOwner must be used within OwnerProvider')
  }
  return value
}
