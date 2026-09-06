import { OpenAPIHono } from '@hono/zod-openapi'
import type { AccessTokenVerifier } from '../../../shared/http/access-token.js'
import { createAuthenticationMiddleware } from '../../../shared/http/authentication-middleware.js'
import type { App, AppVariables } from '../../../shared/http/types.js'
import type {
  AcceptTrackPoint,
  DeleteWalk,
  FinishWalk,
  GetActiveWalk,
  GetWalkDetail,
  RecordEvent,
  StartWalk,
} from '../types.js'
import { registerAcceptTrackPointRoute } from './accept-track-point.js'
import { registerDeleteWalkRoute } from './delete-walk.js'
import { registerFinishWalkRoute } from './finish-walk.js'
import { registerGetActiveWalkRoute } from './get-active-walk.js'
import { registerGetWalkDetailRoute } from './get-walk-detail.js'
import { registerRecordEventRoute } from './record-event.js'
import { registerStartWalkRoute } from './start-walk.js'

export type WalkRouteDependencies = {
  getActiveWalk: GetActiveWalk
  getWalkDetail: GetWalkDetail
  startWalk: StartWalk
  finishWalk: FinishWalk
  deleteWalk: DeleteWalk
  acceptTrackPoint: AcceptTrackPoint
  recordEvent: RecordEvent
  accessTokenVerifier: AccessTokenVerifier
}

export function registerWalkRoutes(dependencies: WalkRouteDependencies): App {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  app.use('*', createAuthenticationMiddleware(dependencies.accessTokenVerifier))
  registerGetActiveWalkRoute(app, dependencies.getActiveWalk)
  registerStartWalkRoute(app, dependencies.startWalk)
  registerGetWalkDetailRoute(app, dependencies.getWalkDetail)
  registerFinishWalkRoute(app, dependencies.finishWalk)
  registerDeleteWalkRoute(app, dependencies.deleteWalk)
  registerAcceptTrackPointRoute(app, dependencies.acceptTrackPoint)
  registerRecordEventRoute(app, dependencies.recordEvent)
  return app
}
