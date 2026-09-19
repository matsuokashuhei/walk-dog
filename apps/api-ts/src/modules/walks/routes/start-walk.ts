import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import {
  idempotencyKeyHeaderSchema,
  recordingWalkResponseSchema,
  startWalkRequestSchema,
  walkErrorSchema,
} from '../contracts.js'
import type { StartWalk } from '../types.js'
import { toRecordingWalkResponse } from '../walk-response.js'

export const startWalkRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['walks'],
  security: [{ BearerAuth: [] }],
  request: {
    headers: idempotencyKeyHeaderSchema,
    body: {
      content: { 'application/json': { schema: startWalkRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: recordingWalkResponseSchema } }, description: 'Created Walk' },
    400: { content: { 'application/json': { schema: walkErrorSchema } }, description: 'Invalid input' },
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

export function registerStartWalkRoute(app: App, startWalk: StartWalk): void {
  app.openapi(startWalkRoute, async (ctx) => {
    const { participantDogIds } = ctx.req.valid('json')
    const { 'idempotency-key': idempotencyKey } = ctx.req.valid('header')
    const result = await startWalk({
      cognitoSubject: ctx.get('principal').cognitoSubject,
      participantDogIds,
      idempotencyKey,
    })
    if (result.ok) {
      return ctx.json(toRecordingWalkResponse(ctx.get('requestId'), result.walk), 201)
    }
    if (result.error === 'not_found') {
      return ctx.json(notFoundBody(ctx.get('requestId')), 404)
    }
    if (result.error === 'active_walk_exists') {
      return ctx.json({
        code: 'ACTIVE_WALK_EXISTS' as const,
        message: 'すでに記録中の散歩があります。',
        requestId: ctx.get('requestId'),
        retryable: false as const,
      }, 409)
    }
    return ctx.json({
      code: 'IDEMPOTENCY_CONFLICT' as const,
      message: '同じ要求を完了できません。最初からやり直してください。',
      requestId: ctx.get('requestId'),
      retryable: false as const,
    }, 409)
  })
}
