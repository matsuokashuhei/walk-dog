import { createRoute, z } from '@hono/zod-openapi'
import type { App } from '../shared/http/types.js'
import type { CognitoClient } from '../auth/cognito.js'
import { authenticationResponseSchema, authErrorSchema } from '../auth/contracts.js'
import { decodeIdTokenSubject, ownerFromCognitoSubject, toAuthenticationResponse } from '../auth/owner.js'
import type { DbInstance } from '../db/client.js'

const signInVerifyRoute = createRoute({
  method: 'post',
  path: '/v1/auth/sign-in/verify',
  tags: ['auth'],
  request: { body: { content: { 'application/json': { schema: z.object({ username: z.string().nonempty(), session: z.string().nonempty(), code: z.string().nonempty() }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: authenticationResponseSchema } }, description: 'Verification successful' },
    400: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Invalid code or input' },
    409: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Authentication failed' },
    429: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Internal server error' },
  },
})

function signInVerifyErrorResponse(error: unknown, requestId: string) {
  if (!(error instanceof Error)) return null
  if (error.name === 'ExpiredCodeException') return { status: 400 as const, body: { code: 'CODE_EXPIRED', message: 'コードの有効期限が切れました。コードを再送してください。', requestId, retryable: true } }
  if (error.name === 'NotAuthorizedException') return { status: 409 as const, body: { code: 'AUTHENTICATION_FAILED', message: '認証情報の有効期限が切れました。コードを再送してください。', requestId, retryable: true } }
  if (error.name === 'CodeMismatchException') return { status: 400 as const, body: { code: 'INVALID_CODE', message: 'コードが正しくありません。同じコードで再試行するか、最初からやり直してください。', requestId, retryable: false } }
  if (error.name === 'TooManyRequestsException' || error.name === 'LimitExceededException') return { status: 429 as const, body: { code: 'RATE_LIMITED', message: 'しばらく待ってから再試行してください。', requestId, retryable: true } }
  return null
}

export function registerSignInVerifyRoute(app: App, database: DbInstance, cognito: CognitoClient): void {
  app.openapi(signInVerifyRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { username: email, session, code } = ctx.req.valid('json')
    try {
      const result = (await cognito.respondToAuthChallenge(email, session, code)).AuthenticationResult
      if (!result?.AccessToken || !result.IdToken || !result.RefreshToken) {
        return ctx.json({ code: 'INTERNAL_SERVER_ERROR', message: '認証情報の取得に失敗しました。', requestId, retryable: true }, 500)
      }
      const owner = await ownerFromCognitoSubject(database, decodeIdTokenSubject(result.IdToken))
      return ctx.json(toAuthenticationResponse(requestId, {
        accessToken: result.AccessToken,
        idToken: result.IdToken,
        refreshToken: result.RefreshToken,
      }, owner), 200)
    } catch (error) {
      const mapped = signInVerifyErrorResponse(error, requestId)
      if (mapped) return ctx.json(mapped.body, mapped.status)
      throw error
    }
  })
}
