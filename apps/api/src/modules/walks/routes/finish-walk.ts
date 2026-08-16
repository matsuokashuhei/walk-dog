import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import {
  completedWalkResponseSchema,
  walkIdParamSchema,
  finishWalkRequestSchema,
  idempotencyKeyHeaderSchema,
  walkErrorSchema,
} from '../contracts.js'
import type { FinishWalk } from '../types.js'
import { toCompletedWalkResponse } from '../walk-response.js'

export const finishWalkRoute = createRoute({
  method: 'post',
  path: '/{walkId}/finish',
  tags: ['walks'],
  security: [{ BearerAuth: [] }],
  request: {
    params: walkIdParamSchema,
    headers: idempotencyKeyHeaderSchema,
    body: {
      content: { 'application/json': { schema: finishWalkRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: completedWalkResponseSchema } }, description: 'Completed Walk' },
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

export function registerFinishWalkRoute(app: App, finishWalk: FinishWalk): void {
  app.openapi(finishWalkRoute, async (ctx) => {
    const { walkId } = ctx.req.valid('param')
    const { 'idempotency-key': idempotencyKey } = ctx.req.valid('header')
    ctx.req.valid('json')
    const result = await finishWalk({
      cognitoSubject: ctx.get('principal').cognitoSubject,
      walkId,
      idempotencyKey,
    })
    if (result.ok) {
      return ctx.json(toCompletedWalkResponse(ctx.get('requestId'), result.walk), 200)
    }
    if (result.error === 'not_found') {
      return ctx.json(notFoundBody(ctx.get('requestId')), 404)
    }
    if (result.error === 'walk_not_recording') {
      return ctx.json({
        code: 'WALK_NOT_RECORDING' as const,
        message: 'この散歩は終了できません。',
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
