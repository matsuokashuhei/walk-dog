import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import {
  eventResponseSchema,
  recordEventRequestSchema,
  walkErrorSchema,
  walkIdParamSchema,
} from '../contracts.js'
import type { RecordEvent } from '../types.js'
import { toEventResponse } from '../walk-response.js'

export const recordEventRoute = createRoute({
  method: 'post',
  path: '/{walkId}/events',
  tags: ['walks'],
  security: [{ BearerAuth: [] }],
  request: {
    params: walkIdParamSchema,
    body: {
      content: { 'application/json': { schema: recordEventRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: eventResponseSchema } }, description: 'Replayed Event' },
    201: { content: { 'application/json': { schema: eventResponseSchema } }, description: 'Recorded Event' },
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
    message: 'Walk が見つかりません。',
    requestId,
    retryable: false as const,
  }
}

function walkNotRecordingBody(requestId: string) {
  return {
    code: 'WALK_NOT_RECORDING' as const,
    message: 'この散歩には記録できません。',
    requestId,
    retryable: false as const,
  }
}

function idempotencyConflictBody(requestId: string) {
  return {
    code: 'IDEMPOTENCY_CONFLICT' as const,
    message: '同じ要求を完了できません。最初からやり直してください。',
    requestId,
    retryable: false as const,
  }
}

function retryableInternalErrorBody(requestId: string) {
  return {
    code: 'INTERNAL_ERROR' as const,
    message: '記録に失敗しました。',
    requestId,
    retryable: true as const,
  }
}

export function registerRecordEventRoute(app: App, recordEvent: RecordEvent): void {
  app.openapi(recordEventRoute, async (ctx) => {
    const { walkId } = ctx.req.valid('param')
    const { eventId, participantDogId, type, occurredAt, latitude, longitude } = ctx.req.valid('json')
    try {
      const result = await recordEvent({
        cognitoSubject: ctx.get('principal').cognitoSubject,
        walkId,
        eventId,
        participantDogId,
        type,
        occurredAt: new Date(occurredAt),
        latitude,
        longitude,
      })
      if (result.ok) {
        return ctx.json(
          toEventResponse(ctx.get('requestId'), result.event),
          result.created ? 201 : 200,
        )
      }
      if (result.error === 'not_found') {
        return ctx.json(notFoundBody(ctx.get('requestId')), 404)
      }
      if (result.error === 'walk_not_recording') {
        return ctx.json(walkNotRecordingBody(ctx.get('requestId')), 409)
      }
      return ctx.json(idempotencyConflictBody(ctx.get('requestId')), 409)
    } catch {
      return ctx.json(retryableInternalErrorBody(ctx.get('requestId')), 500)
    }
  }, (result, ctx) => {
    if (result.success) {
      return
    }
    if (result.error.issues.some((issue) => issue.path[0] === 'walkId')) {
      return ctx.json(notFoundBody(ctx.get('requestId')), 404)
    }
    return ctx.json({
      code: 'INVALID_INPUT' as const,
      message: '入力内容を確認してください。',
      requestId: ctx.get('requestId'),
      retryable: false as const,
    }, 400)
  })
}
