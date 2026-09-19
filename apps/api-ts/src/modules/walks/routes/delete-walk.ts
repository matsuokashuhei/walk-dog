import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import {
  walkErrorSchema,
  walkIdParamSchema,
} from '../contracts.js'
import type { DeleteWalk } from '../types.js'

export const deleteWalkRoute = createRoute({
  method: 'delete',
  path: '/{walkId}',
  tags: ['walks'],
  security: [{ BearerAuth: [] }],
  request: {
    params: walkIdParamSchema,
  },
  responses: {
    204: { description: 'Walk discarded' },
    401: { content: { 'application/json': { schema: walkErrorSchema } }, description: 'Unauthenticated' },
    404: { content: { 'application/json': { schema: walkErrorSchema } }, description: 'Not found' },
    409: { content: { 'application/json': { schema: walkErrorSchema } }, description: 'Conflict' },
    500: { content: { 'application/json': { schema: walkErrorSchema } }, description: 'Internal server error' },
  },
})

function notFoundBody(requestId: string) {
  return {
    code: 'NOT_FOUND' as const,
    message: 'The requested resource was not found.',
    requestId,
    retryable: false as const,
  }
}

export function registerDeleteWalkRoute(app: App, deleteWalk: DeleteWalk): void {
  app.openapi(deleteWalkRoute, async (ctx) => {
    const { walkId } = ctx.req.valid('param')
    const result = await deleteWalk({
      cognitoSubject: ctx.get('principal').cognitoSubject,
      walkId,
    })
    if (result.ok) {
      return ctx.body(null, 204)
    }
    if (result.error === 'not_found') {
      return ctx.json(notFoundBody(ctx.get('requestId')), 404)
    }
    return ctx.json({
      code: 'WALK_NOT_RECORDING' as const,
      message: 'この散歩は破棄できません。',
      requestId: ctx.get('requestId'),
      retryable: false as const,
    }, 409)
  }, (result, ctx) => {
    if (result.success) {
      return
    }
    return ctx.json(notFoundBody(ctx.get('requestId')), 404)
  })
}
