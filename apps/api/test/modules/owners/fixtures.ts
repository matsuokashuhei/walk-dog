import { OpenAPIHono } from '@hono/zod-openapi'
import { createApp } from '../../../src/app.js'
import { setRequestIdTag } from '../../../src/infrastructure/observability/sentry.js'
import { registerHealthyHealthRoutes } from '../../support/health-routes.js'
import type { GetOwner, UpdateOwnerDisplayName } from '../../../src/modules/owners/types.js'
import type { AccessTokenVerifier } from '../../../src/shared/http/access-token.js'
import type { App, AppVariables } from '../../../src/shared/http/types.js'
import { testLogger } from '../../support/test-logger.js'

const appDependencies = { logger: testLogger, setRequestId: setRequestIdTag }

export const unusedGetOwner: GetOwner = async () => {
  throw new Error('getOwner should not run during owner fixture setup')
}

export const unusedUpdateOwnerDisplayName: UpdateOwnerDisplayName = async () => {
  throw new Error('updateOwnerDisplayName should not run during owner fixture setup')
}

export const unusedAccessTokenVerifier: AccessTokenVerifier = {
  async verify() {
    throw new Error('accessTokenVerifier should not run during owner fixture setup')
  },
}

export function createOwnerApp(registerRoutes: (app: App) => void): App {
  const ownerChild = new OpenAPIHono<{ Variables: AppVariables }>()
  registerRoutes(ownerChild)
  return createApp(appDependencies, [
    { path: '/', app: registerHealthyHealthRoutes() },
    { path: '/v1/owner', app: ownerChild },
  ])
}
