import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import {
  walkDetailResponseSchema,
  walkErrorSchema,
  walkIdParamSchema,
} from '../contracts.js'
import type { GetWalkDetail } from '../types.js'
import { toWalkDetailResponse } from '../walk-response.js'

export const getWalkDetailRoute = createRoute({
  method: 'get',
  path: '/{walkId}',
  tags: ['walks'],
  security: [{ BearerAuth: [] }],
  request: {
    params: walkIdParamSchema,
  },
  responses: {
    200: { content: { 'application/json': { schema: walkDetailResponseSchema } }, description: 'Completed Walk Detail' },
    401: { content: { 'application/json': { schema: walkErrorSchema } }, description: 'Unauthenticated' },
    404: { content: { 'application/json': { schema: walkErrorSchema } }, description: 'Not found' },
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

export function registerGetWalkDetailRoute(app: App, getWalkDetail: GetWalkDetail): void {
  app.openapi(getWalkDetailRoute, async (ctx) => {
    const { walkId } = ctx.req.valid('param')
    const result = await getWalkDetail({
      cognitoSubject: ctx.get('principal').cognitoSubject,
      walkId,
    })
    if (result.ok) {
      return ctx.json(toWalkDetailResponse(ctx.get('requestId'), result.detail), 200)
    }
    return ctx.json(notFoundBody(ctx.get('requestId')), 404)
  }, (result, ctx) => {
    if (result.success) {
      return
    }
    return ctx.json(notFoundBody(ctx.get('requestId')), 404)
  })
}
