import { OpenAPIHono } from '@hono/zod-openapi'
import type { App, AppVariables } from '../../shared/http/types.js'
import { healthRoute, registerHealthRoute } from './routes/health.js'
import type { CheckHealth } from './use-cases/check-health.js'

export { healthRoute }
export { createCheckHealth, type CheckHealth } from './use-cases/check-health.js'

export type HealthRouteDependencies = {
  checkHealth: CheckHealth
}

export function registerHealthRoutes(dependencies: HealthRouteDependencies): App {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  registerHealthRoute(app, dependencies.checkHealth)
  return app
}
