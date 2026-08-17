import { OpenAPIHono } from '@hono/zod-openapi'
import { createApp } from '../../../src/app.js'
import { setRequestIdTag } from '../../../src/infrastructure/observability/sentry.js'
import type { CreateDog, GetDog } from '../../../src/modules/dogs/types.js'
import { registerHealthyHealthRoutes } from '../../support/health-routes.js'
import type { App, AppVariables } from '../../../src/shared/http/types.js'
import { testLogger } from '../../support/test-logger.js'

const appDependencies = { logger: testLogger, setRequestId: setRequestIdTag }

export const unusedCreateDog: CreateDog = async () => {
  throw new Error('createDog should not run during dog fixture setup')
}

export const unusedGetDog: GetDog = async () => {
  throw new Error('getDog should not run during dog fixture setup')
}

export function createDogApp(registerRoutes: (app: App) => void): App {
  const dogChild = new OpenAPIHono<{ Variables: AppVariables }>()
  registerRoutes(dogChild)
  return createApp(appDependencies, [
    { path: '/', app: registerHealthyHealthRoutes() },
    { path: '/v1/dogs', app: dogChild },
  ])
}
