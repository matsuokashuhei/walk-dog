import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import { ownerErrorSchema, ownerResponseSchema } from '../contracts.js'
import { toOwnerResponse } from '../owner-response.js'
import type { GetOwner } from '../types.js'

export const getOwnerRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['owners'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: { content: { 'application/json': { schema: ownerResponseSchema } }, description: 'Current Owner' },
    401: { content: { 'application/json': { schema: ownerErrorSchema } }, description: 'Unauthenticated' },
    500: { content: { 'application/json': { schema: ownerErrorSchema } }, description: 'Internal server error' },
  },
})

export function registerGetOwnerRoute(app: App, getOwner: GetOwner): void {
  app.openapi(getOwnerRoute, async (ctx) => {
    const owner = await getOwner(ctx.get('principal').cognitoSubject)
    return ctx.json(toOwnerResponse(ctx.get('requestId'), owner), 200)
  })
}
