import { createRoute, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import type { App } from '../app.js'
import type { DbInstance } from '../db/client.js'
import type { CognitoClient } from '../auth/cognito.js'
import { owners } from '../schema/owner.js'

export type { CognitoClient }

const signUpRequestSchema = z.object({
  email: z.email(),
})

const verifyRequestSchema = z.object({
  username: z.string().min(1),
  session: z.string().min(1).nullable(),
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
  path: '/v1/auth/sign-up',
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
  path: '/v1/auth/verify',
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

function codeDeliveryFromDetails(details: { Destination?: string; AttributeName?: string } | undefined) {
  if (!details) {
    return null
  }
  return {
    destination: details.Destination ?? '',
    attribute: details.AttributeName ?? '',
  }
}

async function signUpChallengeForExistingEmail(
  cognito: CognitoClient,
  email: string,
  requestId: string,
) {
  // ResendConfirmationCode is public (no IAM). Success ⇒ UNCONFIRMED; already confirmed ⇒ InvalidParameterException.
  try {
    const resent = await cognito.resendConfirmationCode(email)
    return {
      status: 200 as const,
      body: {
        requestId,
        username: email,
        session: null,
        codeDelivery: codeDeliveryFromDetails(resent.CodeDeliveryDetails),
      },
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'InvalidParameterException') {
      return {
        status: 409 as const,
        body: {
          code: 'AUTHENTICATION_FAILED',
          message: 'アカウントの作成に失敗しました。サインインしてください。',
          requestId,
          retryable: false,
        },
      }
    }
    throw error
  }
}

function signUpErrorResponse(error: unknown, requestId: string) {
  if (!(error instanceof Error)) {
    return null
  }
  if (error.name === 'InvalidParameterException') {
    return {
      status: 400 as const,
      body: {
        code: 'INVALID_INPUT',
        message: '有効なメールアドレスを入力してください。',
        requestId,
        retryable: false,
      },
    }
  }
  if (error.name === 'TooManyRequestsException' || error.name === 'LimitExceededException') {
    return {
      status: 429 as const,
      body: {
        code: 'RATE_LIMITED',
        message: 'しばらく待ってから再試行してください。',
        requestId,
        retryable: true,
      },
    }
  }
  return null
}

const VERIFY_ERROR_BY_NAME = {
  ExpiredCodeException: {
    status: 400 as const,
    code: 'CODE_EXPIRED',
    message: 'コードの有効期限が切れました。最初からやり直してください。',
    retryable: false,
  },
  CodeMismatchException: {
    status: 400 as const,
    code: 'INVALID_CODE',
    message: 'コードが正しくありません。同じコードで再試行するか、最初からやり直してください。',
    retryable: false,
  },
  NotAuthorizedException: {
    status: 409 as const,
    code: 'AUTHENTICATION_FAILED',
    message: 'このアカウントは既に確認済みです。サインインしてください。',
    retryable: false,
  },
  AliasExistsException: {
    status: 400 as const,
    code: 'CODE_ALREADY_USED',
    message: 'このコードは既に使用されています。サインインしてください。',
    retryable: false,
  },
  TooManyRequestsException: {
    status: 429 as const,
    code: 'RATE_LIMITED',
    message: 'しばらく待ってから再試行してください。',
    retryable: true,
  },
  LimitExceededException: {
    status: 429 as const,
    code: 'RATE_LIMITED',
    message: 'しばらく待ってから再試行してください。',
    retryable: true,
  },
}

function verifyErrorResponse(error: unknown, requestId: string) {
  if (!(error instanceof Error)) {
    return null
  }
  if (!(error.name in VERIFY_ERROR_BY_NAME)) {
    return null
  }
  const mapped = VERIFY_ERROR_BY_NAME[error.name as keyof typeof VERIFY_ERROR_BY_NAME]
  return {
    status: mapped.status,
    body: {
      code: mapped.code,
      message: mapped.message,
      requestId,
      retryable: mapped.retryable,
    },
  }
}

// eslint-disable-next-line max-lines-per-function
export function registerAuthRoutes(
  app: App,
  database: DbInstance,
  cognito: CognitoClient,
): void {

  app.openapi(signUpRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { email } = ctx.req.valid('json')

    try {
      const output = await cognito.signUp(email)
      return ctx.json({
        requestId,
        username: email,
        session: output.Session ?? null,
        codeDelivery: codeDeliveryFromDetails(output.CodeDeliveryDetails),
      }, 200)
    } catch (error) {
      if (error instanceof Error && error.name === 'UsernameExistsException') {
        const result = await signUpChallengeForExistingEmail(cognito, email, requestId)
        if (result.status === 200) {
          return ctx.json(result.body, 200)
        }
        return ctx.json(result.body, 409)
      }
      const mapped = signUpErrorResponse(error, requestId)
      if (mapped) {
        return ctx.json(mapped.body, mapped.status)
      }
      throw error
    }
  })

  app.openapi(verifyRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { username: email, session, code } = ctx.req.valid('json')

    try {
      const confirmOutput = await cognito.confirmSignUp(email, code, session ?? undefined)
      const authSession = confirmOutput.Session ?? session ?? undefined
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
      const mapped = verifyErrorResponse(error, requestId)
      if (mapped) {
        return ctx.json(mapped.body, mapped.status)
      }
      throw error
    }
  })
}
