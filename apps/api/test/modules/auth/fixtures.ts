import { createApp } from '../../../src/app.js'
import { setRequestIdTag } from '../../../src/infrastructure/observability/sentry.js'
import type { App } from '../../../src/shared/http/types.js'
import { testLogger } from '../../support/test-logger.js'

const appDependencies = { logger: testLogger, setRequestId: setRequestIdTag }

export function makeIdToken(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64')
  return `header.${payload}.signature`
}

export function createAuthApp(registerRoutes: (app: App) => void): App {
  return createApp(appDependencies, registerRoutes)
}
