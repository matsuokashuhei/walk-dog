import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import {
  authErrorSchema,
  signUpRequestSchema,
  signUpResponseSchema,
} from '../contracts.js'
import type { StartSignUp } from '../types.js'

export const signUpRoute = createRoute({
  method: 'post',
  path: '/v1/auth/sign-up',
  tags: ['auth'],
  request: { body: { content: { 'application/json': { schema: signUpRequestSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: signUpResponseSchema } }, description: 'Sign-up initiated' },
    400: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Invalid input' },
    409: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Already confirmed' },
    429: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Internal server error' },
  },
})

export function registerSignUpRoute(app: App, startSignUp: StartSignUp): void {
  app.openapi(signUpRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { email } = ctx.req.valid('json')
    const result = await startSignUp({ email })
    switch (result.outcome) {
      case 'challenge':
        return ctx.json({
          requestId,
          username: result.username,
          session: result.session,
          codeDelivery: result.codeDelivery,
        }, 200)
      case 'already-confirmed':
        return ctx.json({
          code: 'AUTHENTICATION_FAILED',
          message: 'アカウントの作成に失敗しました。サインインしてください。',
          requestId,
          retryable: false,
        }, 409)
      case 'invalid-input':
        return ctx.json({
          code: 'INVALID_INPUT',
          message: '有効なメールアドレスを入力してください。',
          requestId,
          retryable: false,
        }, 400)
      case 'rate-limited':
        return ctx.json({
          code: 'RATE_LIMITED',
          message: 'しばらく待ってから再試行してください。',
          requestId,
          retryable: true,
        }, 429)
    }
  })
}
