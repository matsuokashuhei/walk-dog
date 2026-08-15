import { OpenAPIHono } from '@hono/zod-openapi'
import { createApp } from '../../../src/app.js'
import { setRequestIdTag } from '../../../src/infrastructure/observability/sentry.js'
import { registerHealthRoutes } from '../../../src/modules/health/index.js'
import type { FinishWalk, GetActiveWalk, StartWalk } from '../../../src/modules/walks/types.js'
import type { App, AppVariables } from '../../../src/shared/http/types.js'
import { testLogger } from '../../support/test-logger.js'

const appDependencies = { logger: testLogger, setRequestId: setRequestIdTag }

export const unusedGetActiveWalk: GetActiveWalk = async () => {
  throw new Error('getActiveWalk should not run during walk fixture setup')
}

export const unusedStartWalk: StartWalk = async () => {
  throw new Error('startWalk should not run during walk fixture setup')
}

export const unusedFinishWalk: FinishWalk = async () => {
  throw new Error('finishWalk should not run during walk fixture setup')
}

export function createWalkApp(registerRoutes: (app: App) => void): App {
  const walkChild = new OpenAPIHono<{ Variables: AppVariables }>()
  registerRoutes(walkChild)
  return createApp(appDependencies, [
    { path: '/', app: registerHealthRoutes() },
    { path: '/v1/walks', app: walkChild },
  ])
}
