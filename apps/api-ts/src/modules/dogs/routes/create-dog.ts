import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import {
  createDogRequestSchema,
  dogErrorSchema,
  dogResponseSchema,
} from '../contracts.js'
import { toDogResponse } from '../dog-response.js'
import type { CreateDog } from '../types.js'

export const createDogRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['dogs'],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: createDogRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: dogResponseSchema } }, description: 'Created Dog' },
    400: { content: { 'application/json': { schema: dogErrorSchema } }, description: 'Invalid input' },
    401: { content: { 'application/json': { schema: dogErrorSchema } }, description: 'Unauthenticated' },
    409: { content: { 'application/json': { schema: dogErrorSchema } }, description: 'Duplicate dog name' },
    500: { content: { 'application/json': { schema: dogErrorSchema } }, description: 'Internal server error' },
  },
})

export function registerCreateDogRoute(app: App, createDog: CreateDog): void {
  app.openapi(createDogRoute, async (ctx) => {
    const { name, gender, birthday } = ctx.req.valid('json')
    const result = await createDog({
      cognitoSubject: ctx.get('principal').cognitoSubject,
      name,
      gender,
      birthday: birthday ?? { precision: 'unknown' },
    })
    if (result.ok) {
      return ctx.json(toDogResponse(ctx.get('requestId'), result.dog), 201)
    }
    return ctx.json({
      code: 'DOG_NAME_DUPLICATE',
      message: '同じ名前のDogが既に存在します。',
      requestId: ctx.get('requestId'),
      retryable: false,
    }, 409)
  })
}
