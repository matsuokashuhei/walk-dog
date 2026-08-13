import type { MiddlewareHandler } from 'hono'
import type { AccessTokenVerifier, Principal } from './access-token.js'
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

    let principal: Principal
    try {
      principal = await verifier.verify(accessToken)
    } catch {
      return context.json(unauthenticated(context.get('requestId')), 401)
    }

    context.set('principal', principal)
    await next()
  }
}
