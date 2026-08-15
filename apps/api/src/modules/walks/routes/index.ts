import { OpenAPIHono } from '@hono/zod-openapi'
import type { AccessTokenVerifier } from '../../../shared/http/access-token.js'
import { createAuthenticationMiddleware } from '../../../shared/http/authentication-middleware.js'
import type { App, AppVariables } from '../../../shared/http/types.js'
import type { FinishWalk, GetActiveWalk, StartWalk } from '../types.js'
import { registerFinishWalkRoute } from './finish-walk.js'
import { registerGetActiveWalkRoute } from './get-active-walk.js'
import { registerStartWalkRoute } from './start-walk.js'

export type WalkRouteDependencies = {
  getActiveWalk: GetActiveWalk
  startWalk: StartWalk
  finishWalk: FinishWalk
  accessTokenVerifier: AccessTokenVerifier
}

export function registerWalkRoutes(dependencies: WalkRouteDependencies): App {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  app.use('*', createAuthenticationMiddleware(dependencies.accessTokenVerifier))
  registerGetActiveWalkRoute(app, dependencies.getActiveWalk)
  registerStartWalkRoute(app, dependencies.startWalk)
  registerFinishWalkRoute(app, dependencies.finishWalk)
  return app
}
