import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import {
  dogErrorSchema,
  dogIdParamSchema,
  dogResponseSchema,
} from '../contracts.js'
import { toDogResponse } from '../dog-response.js'
import type { GetDog } from '../types.js'

export const getDogRoute = createRoute({
  method: 'get',
  path: '/{dogId}',
  tags: ['dogs'],
  security: [{ BearerAuth: [] }],
  request: {
    params: dogIdParamSchema,
  },
  responses: {
    200: { content: { 'application/json': { schema: dogResponseSchema } }, description: 'Dog profile' },
    401: { content: { 'application/json': { schema: dogErrorSchema } }, description: 'Unauthenticated' },
    404: { content: { 'application/json': { schema: dogErrorSchema } }, description: 'Not found' },
    500: { content: { 'application/json': { schema: dogErrorSchema } }, description: 'Internal server error' },
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

export function registerGetDogRoute(app: App, getDog: GetDog): void {
  app.openapi(getDogRoute, async (ctx) => {
    const { dogId } = ctx.req.valid('param')
    const result = await getDog({
      cognitoSubject: ctx.get('principal').cognitoSubject,
      dogId,
    })
    if (result.ok) {
      return ctx.json(toDogResponse(ctx.get('requestId'), result.dog), 200)
    }
    return ctx.json(notFoundBody(ctx.get('requestId')), 404)
  }, (result, ctx) => {
    if (result.success) {
      return
    }
    return ctx.json(notFoundBody(ctx.get('requestId')), 404)
  })
}
