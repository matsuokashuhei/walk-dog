import * as Sentry from '@sentry/node'

export type SentryConfig = {
  environment: string
  release: string
  sentryDsn: string | undefined
}

export type SentryBridge = {
  setRequestId: (requestId: string) => void
  captureException: (error: unknown) => void
  close: () => Promise<void>
}

export function createSentryBridge(config: SentryConfig): SentryBridge {
  const enabled = Boolean(config.sentryDsn)

  if (enabled) {
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.environment,
      release: config.release,
    })
  }

  return {
    setRequestId: (requestId) => {
      if (!enabled) {
        return
      }

      Sentry.getCurrentScope().setTag('requestId', requestId)
    },
    captureException: (error) => {
      if (!enabled) {
        return
      }

      Sentry.captureException(error)
    },
    close: async () => {
      if (!enabled) {
        return
      }

      await Sentry.close(2000)
    },
  }
}

export function createNoopSentryBridge(): SentryBridge {
  return {
    setRequestId: () => undefined,
    captureException: () => undefined,
    close: async () => undefined,
  }
}
