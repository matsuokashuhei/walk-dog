import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import { toAuthenticationResponse } from '../authentication-response.js'
import {
  authErrorSchema,
  authenticationResponseSchema,
  signInVerifyRequestSchema,
} from '../contracts.js'
import type { VerifySignIn, VerifySignInResult } from '../types.js'

export const signInVerifyRoute = createRoute({
  method: 'post',
  path: '/sign-in/verify',
  tags: ['auth'],
  request: { body: { content: { 'application/json': { schema: signInVerifyRequestSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: authenticationResponseSchema } }, description: 'Verification successful' },
    400: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Invalid code or input' },
    409: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Authentication failed' },
    429: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Internal server error' },
  },
})

const FAILURE = {
  'code-expired': { status: 400 as const, code: 'CODE_EXPIRED', message: 'コードの有効期限が切れました。コードを再送してください。', retryable: true },
  'invalid-code': { status: 400 as const, code: 'INVALID_CODE', message: 'コードが正しくありません。同じコードで再試行するか、最初からやり直してください。', retryable: false },
  'code-already-used': { status: 400 as const, code: 'CODE_ALREADY_USED', message: 'このコードは既に使用されています。サインインしてください。', retryable: false },
  'authentication-failed': { status: 409 as const, code: 'AUTHENTICATION_FAILED', message: '認証情報の有効期限が切れました。コードを再送してください。', retryable: true },
  'rate-limited': { status: 429 as const, code: 'RATE_LIMITED', message: 'しばらく待ってから再試行してください。', retryable: true },
  'incomplete-authentication': { status: 500 as const, code: 'INTERNAL_SERVER_ERROR', message: '認証情報の取得に失敗しました。', retryable: true },
} satisfies Record<Exclude<VerifySignInResult, { outcome: 'authenticated' }>['outcome'], {
  status: 400 | 409 | 429 | 500
  code: string
  message: string
  retryable: boolean
}>

export function registerSignInVerifyRoute(app: App, verifySignIn: VerifySignIn): void {
  app.openapi(signInVerifyRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { username, session, code } = ctx.req.valid('json')
    const result = await verifySignIn({ username, session, code })
    if (result.outcome === 'authenticated') {
      return ctx.json(toAuthenticationResponse(requestId, result.authentication, result.owner), 200)
    }
    const mapped = FAILURE[result.outcome]
    return ctx.json({
      code: mapped.code,
      message: mapped.message,
      requestId,
      retryable: mapped.retryable,
    }, mapped.status)
  })
}
