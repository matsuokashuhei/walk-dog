import { serve } from '@hono/node-server'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'
import {
  createApplication as createProductionApplication,
  type ApplicationResources,
} from './index.js'
import { closeDbClient } from './infrastructure/database/client.js'
import type { App } from './shared/http/types.js'

export type HttpServer = {
  close: (callback: (error?: Error) => void) => unknown
}

export type CognitoResource = {
  destroy: () => void
}

export type SqsResource = {
  destroy: () => void
}

export type StartServer = (options: {
  fetch: App['fetch']
  port: number
}) => HttpServer

export type SignalProcess = {
  once: (event: 'SIGINT' | 'SIGTERM', listener: () => void) => void
}

export type StartServerOptions = {
  env?: NodeJS.ProcessEnv
  createApplication?: (
    env: NodeJS.ProcessEnv,
  ) => { app: App; resources: ApplicationResources }
  start?: StartServer
  port?: number
  process?: SignalProcess
}

function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error)
        return
      }

      resolveClose()
    })
  })
}

async function attemptClose(
  close: () => Promise<void> | void,
  firstError: { current: unknown },
): Promise<void> {
  try {
    await close()
  } catch (error) {
    firstError.current ??= error
  }
}

export function createShutdownHandler(
  server: HttpServer,
  pool: Pool,
  cognito: CognitoResource,
  sqs: SqsResource,
  sentry: { close: () => Promise<void> },
): () => Promise<void> {
  let shutdownPromise: Promise<void> | undefined

  return () => {
    if (shutdownPromise) {
      return shutdownPromise
    }

    shutdownPromise = (async () => {
      const firstError: { current: unknown } = { current: undefined }

      await attemptClose(() => closeHttpServer(server), firstError)
      await attemptClose(() => closeDbClient(pool), firstError)
      await attemptClose(() => {
        cognito.destroy()
      }, firstError)
      await attemptClose(() => {
        sqs.destroy()
      }, firstError)
      await attemptClose(() => sentry.close(), firstError)

      if (firstError.current instanceof Error) {
        throw firstError.current
      }
      if (firstError.current !== undefined) {
        throw new Error('Shutdown failed', { cause: firstError.current })
      }
    })()

    return shutdownPromise
  }
}

function defaultStart(options: { fetch: App['fetch']; port: number }): HttpServer {
  return serve(options)
}

export function startServer(options: StartServerOptions = {}): {
  server: HttpServer
  shutdown: () => Promise<void>
} {
  const env = options.env ?? process.env
  const createApplication = options.createApplication ?? createProductionApplication
  const start = options.start ?? defaultStart
  const port = options.port ?? 3000
  const signalProcess = options.process ?? process

  const { app, resources } = createApplication(env)
  const server = start({ fetch: app.fetch, port })
  const shutdown = createShutdownHandler(
    server,
    resources.pool,
    resources.cognitoClient,
    resources.sqsClient,
    { close: resources.closeSentry },
  )

  signalProcess.once('SIGINT', () => {
    void shutdown()
  })
  signalProcess.once('SIGTERM', () => {
    void shutdown()
  })

  return { server, shutdown }
}

export function isDirectRun(
  moduleUrl: string,
  argvEntry: string | undefined,
): boolean {
  if (!argvEntry) {
    return false
  }

  return fileURLToPath(moduleUrl) === resolve(argvEntry)
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  startServer()
}
