import { OpenAPIHono } from '@hono/zod-openapi'
import type { AccessTokenVerifier } from '../../../shared/http/access-token.js'
import { createAuthenticationMiddleware } from '../../../shared/http/authentication-middleware.js'
import type { App, AppVariables } from '../../../shared/http/types.js'
import type { GetOwner, UpdateOwnerDisplayName } from '../types.js'
import { registerGetOwnerRoute } from './get-owner.js'
import { registerUpdateOwnerRoute } from './update-owner.js'

export type OwnerRouteDependencies = {
  getOwner: GetOwner
  updateOwnerDisplayName: UpdateOwnerDisplayName
  accessTokenVerifier: AccessTokenVerifier
}

export function registerOwnerRoutes(dependencies: OwnerRouteDependencies): App {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  app.use('*', createAuthenticationMiddleware(dependencies.accessTokenVerifier))
  registerGetOwnerRoute(app, dependencies.getOwner)
  registerUpdateOwnerRoute(app, dependencies.updateOwnerDisplayName)
  return app
}
