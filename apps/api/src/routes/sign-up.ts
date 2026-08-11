import { createRoute, z } from '@hono/zod-openapi'
import type { App } from '../shared/http/types.js'
import type { CognitoClient } from '../auth/cognito.js'
import { authErrorSchema } from '../auth/contracts.js'

const signUpRoute = createRoute({
  method: 'post',
  path: '/v1/auth/sign-up',
  tags: ['auth'],
  request: { body: { content: { 'application/json': { schema: z.object({ email: z.email() }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ requestId: z.string(), username: z.string(), session: z.string().nullable(), codeDelivery: z.object({ destination: z.string(), attribute: z.string() }).nullable() }) } }, description: 'Sign-up initiated' },
    400: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Invalid input' },
    409: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Already confirmed' },
    429: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Internal server error' },
  },
})

function codeDeliveryFromDetails(details: { Destination?: string; AttributeName?: string } | undefined) {
  if (!details) return null
  return { destination: details.Destination ?? '', attribute: details.AttributeName ?? '' }
}

async function signUpChallengeForExistingEmail(cognito: CognitoClient, email: string, requestId: string) {
  try {
    const resent = await cognito.resendConfirmationCode(email)
    return { status: 200 as const, body: { requestId, username: email, session: null, codeDelivery: codeDeliveryFromDetails(resent.CodeDeliveryDetails) } }
  } catch (error) {
    if (error instanceof Error && error.name === 'InvalidParameterException') {
      return { status: 409 as const, body: { code: 'AUTHENTICATION_FAILED', message: 'アカウントの作成に失敗しました。サインインしてください。', requestId, retryable: false } }
    }
    throw error
  }
}

function signUpErrorResponse(error: unknown, requestId: string) {
  if (!(error instanceof Error)) return null
  if (error.name === 'InvalidParameterException') {
    return { status: 400 as const, body: { code: 'INVALID_INPUT', message: '有効なメールアドレスを入力してください。', requestId, retryable: false } }
  }
  if (error.name === 'TooManyRequestsException' || error.name === 'LimitExceededException') {
    return { status: 429 as const, body: { code: 'RATE_LIMITED', message: 'しばらく待ってから再試行してください。', requestId, retryable: true } }
  }
  return null
}

export function registerSignUpRoute(app: App, cognito: CognitoClient): void {
  app.openapi(signUpRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const { email } = ctx.req.valid('json')
    try {
      const output = await cognito.signUp(email)
      return ctx.json({ requestId, username: email, session: output.Session ?? null, codeDelivery: codeDeliveryFromDetails(output.CodeDeliveryDetails) }, 200)
    } catch (error) {
      if (error instanceof Error && error.name === 'UsernameExistsException') {
        const result = await signUpChallengeForExistingEmail(cognito, email, requestId)
        if (result.status === 200) return ctx.json(result.body, 200)
        return ctx.json(result.body, 409)
      }
      const mapped = signUpErrorResponse(error, requestId)
      if (mapped) return ctx.json(mapped.body, mapped.status)
      throw error
    }
  })
}
