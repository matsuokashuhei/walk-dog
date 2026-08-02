import { createRoute, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import type { App } from '../app.js'
import type { DbInstance } from '../db/client.js'
import { createCognitoClient, type CognitoConfig } from '../auth/cognito.js'
import { owners } from '../schema/owner.js'

const signUpRequestSchema = z.object({
  email: z.email(),
})

const verifyRequestSchema = z.object({
  username: z.string().min(1),
  session: z.string().min(1),
  code: z.string().min(1),
})

const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  retryable: z.boolean(),
})

const ownerResponseSchema = z.object({
  ownerId: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const signUpResponseSchema = z.object({
  requestId: z.string(),
  username: z.string(),
  session: z.string().nullable(),
  codeDelivery: z.object({
    destination: z.string(),
    attribute: z.string(),
  }).nullable(),
})

const verifyResponseSchema = z.object({
  requestId: z.string(),
  accessToken: z.string(),
  idToken: z.string(),
  refreshToken: z.string(),
  owner: ownerResponseSchema,
})

const signUpRoute = createRoute({
  method: 'post',
  path: '/auth/sign-up',
  tags: ['auth'],
  request: {
    body: { content: { 'application/json': { schema: signUpRequestSchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: signUpResponseSchema } }, description: 'Sign-up initiated' },
    400: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid input' },
    409: { content: { 'application/json': { schema: errorSchema } }, description: 'Already confirmed' },
    429: { content: { 'application/json': { schema: errorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: errorSchema } }, description: 'Internal server error' },
  },
})

const verifyRoute = createRoute({
  method: 'post',
  path: '/auth/verify',
  tags: ['auth'],
  request: {
    body: { content: { 'application/json': { schema: verifyRequestSchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: verifyResponseSchema } }, description: 'Verification successful' },
    400: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid code or input' },
    409: { content: { 'application/json': { schema: errorSchema } }, description: 'Already confirmed' },
    429: { content: { 'application/json': { schema: errorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: errorSchema } }, description: 'Internal server error' },
  },
})

type JwtPayload = { sub: string }

function decodeIdTokenSubject(idToken: string): string {
  const parts = idToken.split('.')
  const payload = parts[1]
  if (!payload) {
    throw new Error('Invalid ID token format')
  }
  const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')) as JwtPayload
  return decoded.sub
}

function ownerFromCognitoSubject(
  database: DbInstance,
  cognitoSubject: string,
): Promise<{ ownerId: string; createdAt: Date; updatedAt: Date }> {
  return database.transaction(async (trx) => {
    const inserted = await trx.insert(owners).values({
      cognitoSubject,
      displayName: null,
    }).onConflictDoNothing().returning()

    if (inserted.length > 0) {
      return { ownerId: inserted[0].ownerId, createdAt: inserted[0].createdAt, updatedAt: inserted[0].updatedAt }
    }

    const existing = await trx.select().from(owners).where(eq(owners.cognitoSubject, cognitoSubject)).limit(1)
    return { ownerId: existing[0].ownerId, createdAt: existing[0].createdAt, updatedAt: existing[0].updatedAt }
  })
}

// eslint-disable-next-line max-lines-per-function
export function registerAuthRoutes(
  app: App,
  cognitoConfig: CognitoConfig,
  database: DbInstance,
): void {
  const cognito = createCognitoClient(cognitoConfig)

  app.openapi(signUpRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { email } = ctx.req.valid('json')

    try {
      const output = await cognito.signUp(email)
      return ctx.json({
        requestId,
        username: output.UserSub ?? email,
        session: output.Session ?? null,
        codeDelivery: output.CodeDeliveryDetails
          ? { destination: output.CodeDeliveryDetails.Destination ?? '', attribute: output.CodeDeliveryDetails.AttributeName ?? '' }
          : null,
      }, 200)
    } catch (error) {
      if (error instanceof Error && error.name === 'UsernameExistsException') {
        return ctx.json({ code: 'AUTHENTICATION_FAILED', message: 'アカウントの作成に失敗しました。サインインしてください。', requestId, retryable: false }, 409)
      }
      if (error instanceof Error && error.name === 'InvalidParameterException') {
        return ctx.json({ code: 'INVALID_INPUT', message: '有効なメールアドレスを入力してください。', requestId, retryable: false }, 400)
      }
      throw error
    }
  })

  app.openapi(verifyRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { username: email, session, code } = ctx.req.valid('json')

    try {
      const confirmOutput = await cognito.confirmSignUp(email, code, session)
      const authSession = confirmOutput.Session ?? session
      const authOutput = await cognito.initiateAuth(email, authSession)
      const authResult = authOutput.AuthenticationResult

      if (!authResult || !authResult.AccessToken || !authResult.IdToken || !authResult.RefreshToken) {
        return ctx.json({ code: 'INTERNAL_SERVER_ERROR', message: '認証情報の取得に失敗しました。', requestId, retryable: true }, 500)
      }

      const cognitoSubject = decodeIdTokenSubject(authResult.IdToken)
      const owner = await ownerFromCognitoSubject(database, cognitoSubject)

      return ctx.json({
        requestId,
        accessToken: authResult.AccessToken,
        idToken: authResult.IdToken,
        refreshToken: authResult.RefreshToken,
        owner: {
          ownerId: owner.ownerId,
          displayName: null,
          avatarUrl: null,
          createdAt: owner.createdAt.toISOString(),
          updatedAt: owner.updatedAt.toISOString(),
        },
      }, 200)
    } catch (error) {
      if (error instanceof Error) {
        switch (error.name) {
          case 'ExpiredCodeException':
            return ctx.json({ code: 'CODE_EXPIRED', message: 'コードの有効期限が切れました。最初からやり直してください。', requestId, retryable: false }, 400)
          case 'CodeMismatchException':
            return ctx.json({ code: 'INVALID_CODE', message: 'コードが正しくありません。同じコードで再試行するか、最初からやり直してください。', requestId, retryable: false }, 400)
          case 'NotAuthorizedException':
            return ctx.json({ code: 'AUTHENTICATION_FAILED', message: 'このアカウントは既に確認済みです。サインインしてください。', requestId, retryable: false }, 409)
          case 'AliasExistsException':
            return ctx.json({ code: 'CODE_ALREADY_USED', message: 'このコードは既に使用されています。サインインしてください。', requestId, retryable: false }, 400)
        }
      }
      throw error
    }
  })
}
