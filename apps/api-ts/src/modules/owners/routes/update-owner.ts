import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import { ownerErrorSchema, ownerResponseSchema, updateOwnerRequestSchema } from '../contracts.js'
import { toOwnerResponse } from '../owner-response.js'
import type { UpdateOwnerDisplayName } from '../types.js'

export const updateOwnerRoute = createRoute({
  method: 'patch',
  path: '/',
  tags: ['owners'],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: updateOwnerRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: ownerResponseSchema } }, description: 'Updated Owner' },
    400: { content: { 'application/json': { schema: ownerErrorSchema } }, description: 'Invalid input' },
    401: { content: { 'application/json': { schema: ownerErrorSchema } }, description: 'Unauthenticated' },
    500: { content: { 'application/json': { schema: ownerErrorSchema } }, description: 'Internal server error' },
  },
})

export function registerUpdateOwnerRoute(
  app: App,
  updateOwnerDisplayName: UpdateOwnerDisplayName,
): void {
  app.openapi(updateOwnerRoute, async (ctx) => {
    const { displayName } = ctx.req.valid('json')
    const owner = await updateOwnerDisplayName({
      cognitoSubject: ctx.get('principal').cognitoSubject,
      displayName,
    })
    return ctx.json(toOwnerResponse(ctx.get('requestId'), owner), 200)
  })
}
