import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import { dogErrorSchema, dogListResponseSchema } from '../contracts.js'
import { toDogFields } from '../dog-response.js'
import type { ListDogs } from '../types.js'

export const listDogsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['dogs'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: { content: { 'application/json': { schema: dogListResponseSchema } }, description: 'Owner dogs' },
    401: { content: { 'application/json': { schema: dogErrorSchema } }, description: 'Unauthenticated' },
    500: { content: { 'application/json': { schema: dogErrorSchema } }, description: 'Internal server error' },
  },
})

export function registerListDogsRoute(app: App, listDogs: ListDogs): void {
  app.openapi(listDogsRoute, async (ctx) => {
    const dogs = await listDogs(ctx.get('principal').cognitoSubject)
    return ctx.json({
      requestId: ctx.get('requestId'),
      dogs: dogs.map(toDogFields),
    }, 200)
  })
}
