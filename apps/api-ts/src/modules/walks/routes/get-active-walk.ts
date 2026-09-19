import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import { recordingWalkResponseSchema, walkErrorSchema } from '../contracts.js'
import type { GetActiveWalk } from '../types.js'
import { toRecordingWalkResponse } from '../walk-response.js'

export const getActiveWalkRoute = createRoute({
  method: 'get',
  path: '/active',
  tags: ['walks'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: { content: { 'application/json': { schema: recordingWalkResponseSchema } }, description: 'Active Walk' },
    204: { description: 'No active walk' },
    401: { content: { 'application/json': { schema: walkErrorSchema } }, description: 'Unauthenticated' },
    500: { content: { 'application/json': { schema: walkErrorSchema } }, description: 'Internal server error' },
  },
})

export function registerGetActiveWalkRoute(app: App, getActiveWalk: GetActiveWalk): void {
  app.openapi(getActiveWalkRoute, async (ctx) => {
    const walk = await getActiveWalk(ctx.get('principal').cognitoSubject)
    if (walk === null) {
      return ctx.body(null, 204)
    }
    return ctx.json(toRecordingWalkResponse(ctx.get('requestId'), walk), 200)
  })
}
