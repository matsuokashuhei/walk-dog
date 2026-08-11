import { createRoute, z } from '@hono/zod-openapi'
import type { App } from '../shared/http/types.js'
import type { CognitoClient } from '../infrastructure/cognito/client.js'
import { authenticationResponseSchema, authErrorSchema } from '../auth/contracts.js'
import { decodeIdTokenSubject, ownerFromCognitoSubject, toAuthenticationResponse } from '../auth/owner.js'
import type { DbInstance } from '../infrastructure/database/client.js'

const signUpVerifyRoute = createRoute({
  method: 'post',
  path: '/v1/auth/sign-up/verify',
  tags: ['auth'],
  request: { body: { content: { 'application/json': { schema: z.object({ username: z.string().nonempty(), session: z.string().nonempty().nullable(), code: z.string().nonempty() }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: authenticationResponseSchema } }, description: 'Verification successful' },
    400: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Invalid code or input' },
    409: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Already confirmed' },
    429: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Internal server error' },
  },
})

const SIGN_UP_VERIFY_ERROR_BY_NAME = {
  ExpiredCodeException: { status: 400 as const, code: 'CODE_EXPIRED', message: 'コードの有効期限が切れました。最初からやり直してください。', retryable: false },
  CodeMismatchException: { status: 400 as const, code: 'INVALID_CODE', message: 'コードが正しくありません。同じコードで再試行するか、最初からやり直してください。', retryable: false },
  NotAuthorizedException: { status: 409 as const, code: 'AUTHENTICATION_FAILED', message: 'このアカウントは既に確認済みです。サインインしてください。', retryable: false },
  AliasExistsException: { status: 400 as const, code: 'CODE_ALREADY_USED', message: 'このコードは既に使用されています。サインインしてください。', retryable: false },
  TooManyRequestsException: { status: 429 as const, code: 'RATE_LIMITED', message: 'しばらく待ってから再試行してください。', retryable: true },
  LimitExceededException: { status: 429 as const, code: 'RATE_LIMITED', message: 'しばらく待ってから再試行してください。', retryable: true },
}

function signUpVerifyErrorResponse(error: unknown, requestId: string) {
  if (!(error instanceof Error) || !(error.name in SIGN_UP_VERIFY_ERROR_BY_NAME)) return null
  const mapped = SIGN_UP_VERIFY_ERROR_BY_NAME[error.name as keyof typeof SIGN_UP_VERIFY_ERROR_BY_NAME]
  return { status: mapped.status, body: { code: mapped.code, message: mapped.message, requestId, retryable: mapped.retryable } }
}

export function registerSignUpVerifyRoute(app: App, database: DbInstance, cognito: CognitoClient): void {
  app.openapi(signUpVerifyRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { username: email, session, code } = ctx.req.valid('json')
    try {
      const confirmOutput = await cognito.confirmSignUp(email, code, session ?? undefined)
      const authOutput = await cognito.initiateAuth(email, confirmOutput.Session ?? session ?? undefined)
      const authResult = authOutput.AuthenticationResult
      if (!authResult?.AccessToken || !authResult.IdToken || !authResult.RefreshToken) {
        return ctx.json({ code: 'INTERNAL_SERVER_ERROR', message: '認証情報の取得に失敗しました。', requestId, retryable: true }, 500)
      }
      const owner = await ownerFromCognitoSubject(database, decodeIdTokenSubject(authResult.IdToken))
      return ctx.json(toAuthenticationResponse(requestId, {
        accessToken: authResult.AccessToken,
        idToken: authResult.IdToken,
        refreshToken: authResult.RefreshToken,
      }, owner), 200)
    } catch (error) {
      const mapped = signUpVerifyErrorResponse(error, requestId)
      if (mapped) return ctx.json(mapped.body, mapped.status)
      throw error
    }
  })
}
