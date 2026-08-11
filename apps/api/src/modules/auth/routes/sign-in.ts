import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import {
  authErrorSchema,
  signInRequestSchema,
  signInResponseSchema,
} from '../contracts.js'
import type { StartSignIn } from '../types.js'

export const signInRoute = createRoute({
  method: 'post',
  path: '/v1/auth/sign-in',
  tags: ['auth'],
  request: { body: { content: { 'application/json': { schema: signInRequestSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: signInResponseSchema } }, description: 'Sign-in challenge started' },
    400: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Invalid input' },
    409: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Authentication failed' },
    429: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Internal server error' },
  },
})

export function registerSignInRoute(app: App, startSignIn: StartSignIn): void {
  app.openapi(signInRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { email } = ctx.req.valid('json')
    const result = await startSignIn({ email })
    switch (result.outcome) {
      case 'challenge':
        return ctx.json({
          requestId,
          username: result.username,
          session: result.session,
          codeDelivery: result.codeDelivery,
        }, 200)
      case 'authentication-failed':
        return ctx.json({
          code: 'AUTHENTICATION_FAILED',
          message: 'サインインに失敗しました。入力内容を確認してください。',
          requestId,
          retryable: false,
        }, 409)
      case 'rate-limited':
        return ctx.json({
          code: 'RATE_LIMITED',
          message: 'しばらく待ってから再試行してください。',
          requestId,
          retryable: true,
        }, 429)
      case 'incomplete-challenge':
        return ctx.json({
          code: 'INTERNAL_SERVER_ERROR',
          message: '認証情報の取得に失敗しました。',
          requestId,
          retryable: true,
        }, 500)
    }
  })
}
