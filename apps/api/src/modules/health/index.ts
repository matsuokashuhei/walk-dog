import { OpenAPIHono } from '@hono/zod-openapi'
import type { App, AppVariables } from '../../shared/http/types.js'
import { healthRoute, registerHealthRoute } from './routes/health.js'

export { healthRoute }

export function registerHealthRoutes(): App {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  registerHealthRoute(app)
  return app
}
