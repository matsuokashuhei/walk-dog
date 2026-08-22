import { createRoute } from '@hono/zod-openapi'
import { errorSchema } from '../../../shared/http/error-contract.js'
import type { App } from '../../../shared/http/types.js'
import { healthResponseSchema } from '../contracts.js'
import type { CheckHealth } from '../use-cases/check-health.js'

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      content: { 'application/json': { schema: healthResponseSchema } },
      description: 'API, worker, and PostgreSQL are available',
      headers: {
        'X-Request-Id': {
          description: 'Request identifier for this response',
          schema: { type: 'string' },
        },
      },
    },
    503: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'A required dependency is unavailable',
    },
    500: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'API processing error',
    },
  },
})

export function registerHealthRoute(app: App, checkHealth: CheckHealth): void {
  app.openapi(healthRoute, async (context) => {
    const result = await checkHealth()
    if (!result.ok) {
      return context.json({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'A required dependency is unavailable.',
        requestId: context.get('requestId'),
        retryable: true,
      }, 503)
    }
    return context.json({ status: 'ok' as const }, 200)
  })
}
