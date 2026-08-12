import { createRoute } from '@hono/zod-openapi'
import { errorSchema } from '../../../shared/http/error-contract.js'
import type { App } from '../../../shared/http/types.js'
import { healthResponseSchema } from '../contracts.js'

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      content: { 'application/json': { schema: healthResponseSchema } },
      description: 'API process health state',
      headers: {
        'X-Request-Id': {
          description: 'Request identifier for this response',
          schema: { type: 'string' },
        },
      },
    },
    500: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'API processing error',
    },
  },
})

export function registerHealthRoute(app: App): void {
  app.openapi(healthRoute, (context) => context.json({ status: 'ok' as const }, 200))
}
