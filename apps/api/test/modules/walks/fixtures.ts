import { OpenAPIHono } from '@hono/zod-openapi'
import { createApp } from '../../../src/app.js'
import { setRequestIdTag } from '../../../src/infrastructure/observability/sentry.js'
import { registerHealthyHealthRoutes } from '../../support/health-routes.js'
import type {
  AcceptTrackPoint,
  DeleteWalk,
  FinishWalk,
  GetActiveWalk,
  RecordEvent,
  StartWalk,
} from '../../../src/modules/walks/types.js'
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

export const unusedDeleteWalk: DeleteWalk = async () => {
  throw new Error('deleteWalk should not run during walk fixture setup')
}

export const unusedAcceptTrackPoint: AcceptTrackPoint = async () => {
  throw new Error('acceptTrackPoint should not run during walk fixture setup')
}

export const unusedRecordEvent: RecordEvent = async () => {
  throw new Error('recordEvent should not run during walk fixture setup')
}

export function createWalkApp(registerRoutes: (app: App) => void): App {
  const walkChild = new OpenAPIHono<{ Variables: AppVariables }>()
  registerRoutes(walkChild)
  return createApp(appDependencies, [
    { path: '/', app: registerHealthyHealthRoutes() },
    { path: '/v1/walks', app: walkChild },
  ])
}
