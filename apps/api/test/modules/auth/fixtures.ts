import { OpenAPIHono } from '@hono/zod-openapi'
import { createApp } from '../../../src/app.js'
import { setRequestIdTag } from '../../../src/infrastructure/observability/sentry.js'
import { registerHealthRoutes } from '../../../src/modules/health/index.js'
import type { App, AppVariables } from '../../../src/shared/http/types.js'
import { testLogger } from '../../support/test-logger.js'

const appDependencies = { logger: testLogger, setRequestId: setRequestIdTag }

export function makeIdToken(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64')
  return `header.${payload}.signature`
}

export function createAuthApp(registerRoutes: (app: App) => void): App {
  const authChild = new OpenAPIHono<{ Variables: AppVariables }>()
  registerRoutes(authChild)
  return createApp(appDependencies, [
    { path: '/', app: registerHealthRoutes() },
    { path: '/v1/auth', app: authChild },
  ])
}
