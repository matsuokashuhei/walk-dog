import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

type Variables = { requestId: string }

export type App = OpenAPIHono<{ Variables: Variables }>

const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  retryable: z.boolean(),
})

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ status: z.literal('ok') }) } },
      description: 'API process health state',
    },
    500: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'API processing error',
    },
  },
})

export const createApp = (registerRoutes?: (app: App) => void): App => {
  const app = new OpenAPIHono<{ Variables: Variables }>()
  app.openAPIRegistry.register('Error', errorSchema)
  app.openapi(healthRoute, (context) => context.json({ status: 'ok' }, 200))
  registerRoutes?.(app)
  return app
}
