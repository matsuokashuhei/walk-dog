import { createRoute, z } from '@hono/zod-openapi'
import type { App } from '../app.js'
import type { CognitoClient } from '../auth/cognito.js'
import type { DbInstance } from '../db/client.js'
import { decodeIdTokenSubject, ownerFromCognitoSubject } from './auth-owner.js'

const requestSchema = z.object({ email: z.email() })
const verifyRequestSchema = z.object({
  username: z.string().nonempty(),
  session: z.string().nonempty(),
  code: z.string().nonempty(),
})
const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  retryable: z.boolean(),
})
const ownerSchema = z.object({
  ownerId: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
const startResponseSchema = z.object({
  requestId: z.string(),
  username: z.string(),
  session: z.string().nonempty(),
  codeDelivery: z.object({ destination: z.string(), attribute: z.string() }),
})
const verifyResponseSchema = z.object({
  requestId: z.string(),
  accessToken: z.string(),
  idToken: z.string(),
  refreshToken: z.string(),
  owner: ownerSchema,
})

const startRoute = createRoute({
  method: 'post', path: '/v1/auth/sign-in', tags: ['auth'],
  request: { body: { content: { 'application/json': { schema: requestSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: startResponseSchema } }, description: 'Sign-in challenge started' },
    400: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid input' },
    409: { content: { 'application/json': { schema: errorSchema } }, description: 'Authentication failed' },
    429: { content: { 'application/json': { schema: errorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: errorSchema } }, description: 'Internal server error' },
  },
})

const verifyRoute = createRoute({
  method: 'post', path: '/v1/auth/sign-in/verify', tags: ['auth'],
  request: { body: { content: { 'application/json': { schema: verifyRequestSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: verifyResponseSchema } }, description: 'Verification successful' },
    400: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid code or input' },
    409: { content: { 'application/json': { schema: errorSchema } }, description: 'Authentication failed' },
    429: { content: { 'application/json': { schema: errorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: errorSchema } }, description: 'Internal server error' },
  },
})

function startError(error: unknown, requestId: string) {
  if (!(error instanceof Error)) return null
  if (error.name === 'TooManyRequestsException' || error.name === 'LimitExceededException') {
    return { status: 429 as const, body: { code: 'RATE_LIMITED', message: 'しばらく待ってから再試行してください。', requestId, retryable: true } }
  }
  if (error.name === 'UserNotFoundException' || error.name === 'UserNotConfirmedException' || error.name === 'NotAuthorizedException') {
    return { status: 409 as const, body: { code: 'AUTHENTICATION_FAILED', message: 'サインインに失敗しました。入力内容を確認してください。', requestId, retryable: false } }
  }
  return null
}

function verifyError(error: unknown, requestId: string) {
  if (!(error instanceof Error)) return null
  if (error.name === 'ExpiredCodeException') return { status: 400 as const, body: { code: 'CODE_EXPIRED', message: 'コードの有効期限が切れました。コードを再送してください。', requestId, retryable: true } }
  if (error.name === 'NotAuthorizedException') return { status: 409 as const, body: { code: 'AUTHENTICATION_FAILED', message: '認証情報の有効期限が切れました。コードを再送してください。', requestId, retryable: true } }
  if (error.name === 'CodeMismatchException') return { status: 400 as const, body: { code: 'INVALID_CODE', message: 'コードが正しくありません。同じコードで再試行するか、最初からやり直してください。', requestId, retryable: false } }
  if (error.name === 'TooManyRequestsException' || error.name === 'LimitExceededException') return { status: 429 as const, body: { code: 'RATE_LIMITED', message: 'しばらく待ってから再試行してください。', requestId, retryable: true } }
  return null
}

export function registerSignInRoutes(app: App, database: DbInstance, cognito: CognitoClient): void {
  app.openapi(startRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { email } = ctx.req.valid('json')
    try {
      const output = await cognito.initiateAuth(email)
      if (output.ChallengeName !== 'EMAIL_OTP' || !output.Session) return ctx.json({ code: 'INTERNAL_SERVER_ERROR', message: '認証情報の取得に失敗しました。', requestId, retryable: true }, 500)
      return ctx.json({ requestId, username: email, session: output.Session, codeDelivery: { destination: output.ChallengeParameters?.CODE_DELIVERY_DESTINATION ?? '', attribute: 'email' } }, 200)
    } catch (error) {
      const mapped = startError(error, requestId)
      if (mapped) return ctx.json(mapped.body, mapped.status)
      throw error
    }
  })

  app.openapi(verifyRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { username: email, session, code } = ctx.req.valid('json')
    try {
      const result = (await cognito.respondToAuthChallenge(email, session, code)).AuthenticationResult
      if (!result?.AccessToken || !result.IdToken || !result.RefreshToken) return ctx.json({ code: 'INTERNAL_SERVER_ERROR', message: '認証情報の取得に失敗しました。', requestId, retryable: true }, 500)
      const owner = await ownerFromCognitoSubject(database, decodeIdTokenSubject(result.IdToken))
      return ctx.json({ requestId, accessToken: result.AccessToken, idToken: result.IdToken, refreshToken: result.RefreshToken, owner: { ownerId: owner.ownerId, displayName: null, avatarUrl: null, createdAt: owner.createdAt.toISOString(), updatedAt: owner.updatedAt.toISOString() } }, 200)
    } catch (error) {
      const mapped = verifyError(error, requestId)
      if (mapped) return ctx.json(mapped.body, mapped.status)
      throw error
    }
  })
}
