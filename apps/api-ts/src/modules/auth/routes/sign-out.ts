import { createRoute } from '@hono/zod-openapi'
import type { App } from '../../../shared/http/types.js'
import {
  authErrorSchema,
  signOutRequestSchema,
} from '../contracts.js'
import type { SignOut, SignOutResult } from '../types.js'

export const signOutRoute = createRoute({
  method: 'post',
  path: '/sign-out',
  tags: ['auth'],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: signOutRequestSchema } },
      required: false,
    },
  },
  responses: {
    204: { description: 'Signed out' },
    400: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Invalid input' },
    401: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Unauthenticated' },
    429: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Rate limited' },
    500: { content: { 'application/json': { schema: authErrorSchema } }, description: 'Internal server error' },
  },
})

const FAILURE = {
  'authentication-failed': {
    status: 401 as const,
    code: 'UNAUTHENTICATED',
    message: 'Authentication is required.',
    retryable: false,
  },
  'rate-limited': {
    status: 429 as const,
    code: 'RATE_LIMITED',
    message: 'しばらく待ってから再試行してください。',
    retryable: true,
  },
} satisfies Record<Exclude<SignOutResult, { outcome: 'signed-out' }>['outcome'], {
  status: 401 | 429
  code: string
  message: string
  retryable: boolean
}>

function bearerAccessToken(authorization: string | undefined): string {
  const match = authorization === undefined ? null : /^Bearer\s+(\S+)$/i.exec(authorization)
  const accessToken = match?.[1]
  if (accessToken === undefined) {
    throw new Error('authenticated sign-out request is missing a Bearer access token')
  }
  return accessToken
}

export function registerSignOutRoute(app: App, signOut: SignOut): void {
  app.openapi(signOutRoute, async (ctx) => {
    const requestId = ctx.get('requestId')
    const result = await signOut({
      cognitoSubject: ctx.get('principal').cognitoSubject,
      accessToken: bearerAccessToken(ctx.req.header('Authorization')),
    })
    if (result.outcome === 'signed-out') {
      return ctx.body(null, 204)
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
