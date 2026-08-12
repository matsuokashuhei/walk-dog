import type { MiddlewareHandler } from 'hono'
import type { AccessTokenVerifier } from '../../infrastructure/cognito/access-token-verifier.js'
import type { AppVariables } from './types.js'

const unauthenticated = (requestId: string) => ({
  code: 'UNAUTHENTICATED' as const,
  message: 'Authentication is required.',
  requestId,
  retryable: false as const,
})

function bearerAccessToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorization)
  return match?.[1] ?? null
}

export function createAuthenticationMiddleware(
  verifier: AccessTokenVerifier,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (context, next) => {
    const accessToken = bearerAccessToken(context.req.header('Authorization'))
    if (accessToken === null) {
      return context.json(unauthenticated(context.get('requestId')), 401)
    }

    try {
      const principal = await verifier.verify(accessToken)
      context.set('principal', principal)
      await next()
      return
    } catch {
      return context.json(unauthenticated(context.get('requestId')), 401)
    }
  }
}
