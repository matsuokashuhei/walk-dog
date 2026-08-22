import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import {
  acceptTrackPointRequestSchema,
  trackPointResponseSchema,
  walkErrorSchema,
  walkIdParamSchema,
} from '../contracts.js'
import type { AcceptTrackPoint } from '../types.js'
import { toTrackPointResponse } from '../walk-response.js'

export const acceptTrackPointRoute = createRoute({
  method: 'post',
  path: '/{walkId}/track-points',
  tags: ['walks'],
  security: [{ BearerAuth: [] }],
  request: {
    params: walkIdParamSchema,
    body: {
      content: { 'application/json': { schema: acceptTrackPointRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: trackPointResponseSchema } }, description: 'Accepted TrackPoint' },
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
    message: 'この Walk は記録中ではありません。',
    requestId,
    retryable: false as const,
  }
}

function idempotencyConflictBody(requestId: string) {
  return {
    code: 'IDEMPOTENCY_CONFLICT' as const,
    message: '同じ取得時刻の TrackPoint が別の内容で送られています。',
    requestId,
    retryable: false as const,
  }
}

function retryableInternalErrorBody(requestId: string) {
  return {
    code: 'INTERNAL_ERROR' as const,
    message: '一時的に送信できません。',
    requestId,
    retryable: true as const,
  }
}

export function registerAcceptTrackPointRoute(app: App, acceptTrackPoint: AcceptTrackPoint): void {
  app.openapi(acceptTrackPointRoute, async (ctx) => {
    const { walkId } = ctx.req.valid('param')
    const { recordedAt, latitude, longitude } = ctx.req.valid('json')
    try {
      const result = await acceptTrackPoint({
        cognitoSubject: ctx.get('principal').cognitoSubject,
        walkId,
        recordedAt: new Date(recordedAt),
        latitude,
        longitude,
      })
      if (result.ok) {
        return ctx.json(toTrackPointResponse(ctx.get('requestId'), result.trackPoint), 201)
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
