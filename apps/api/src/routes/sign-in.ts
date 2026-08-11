import { createRoute, z } from '@hono/zod-openapi'
import type { App } from '../shared/http/types.js'
import type { CognitoClient } from '../auth/cognito.js'
import { authErrorSchema } from '../auth/contracts.js'

const signInRoute = createRoute({
  method: 'post',
  path: '/v1/auth/sign-in',
  tags: ['auth'],
  request: { body: { content: { 'application/json': { schema: z.object({ email: z.email() }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ requestId: z.string(), username: z.string(), session: z.string().nonempty(), codeDelivery: z.object({ destination: z.string(), attribute: z.string() }) }) } }, description: 'Sign-in challenge started' },
    400: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Invalid input' },
    409: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Authentication failed' },
    429: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Internal server error' },
  },
})

function signInErrorResponse(error: unknown, requestId: string) {
  if (!(error instanceof Error)) return null
  if (error.name === 'TooManyRequestsException' || error.name === 'LimitExceededException') {
    return { status: 429 as const, body: { code: 'RATE_LIMITED', message: 'しばらく待ってから再試行してください。', requestId, retryable: true } }
  }
  if (error.name === 'UserNotFoundException' || error.name === 'UserNotConfirmedException' || error.name === 'NotAuthorizedException') {
    return { status: 409 as const, body: { code: 'AUTHENTICATION_FAILED', message: 'サインインに失敗しました。入力内容を確認してください。', requestId, retryable: false } }
  }
  return null
}

export function registerSignInRoute(app: App, cognito: CognitoClient): void {
  app.openapi(signInRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { email } = ctx.req.valid('json')
    try {
      const output = await cognito.initiateAuth(email)
      if (output.ChallengeName !== 'EMAIL_OTP' || !output.Session) {
        return ctx.json({ code: 'INTERNAL_SERVER_ERROR', message: '認証情報の取得に失敗しました。', requestId, retryable: true }, 500)
      }
      return ctx.json({ requestId, username: email, session: output.Session, codeDelivery: { destination: output.ChallengeParameters?.CODE_DELIVERY_DESTINATION ?? '', attribute: 'email' } }, 200)
    } catch (error) {
      const mapped = signInErrorResponse(error, requestId)
      if (mapped) return ctx.json(mapped.body, mapped.status)
      throw error
    }
  })
}
