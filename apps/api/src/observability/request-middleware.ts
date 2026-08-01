import { createMiddleware } from 'hono/factory'
import type { Logger } from './logger.js'
import type { SentryBridge } from './sentry.js'

type ObservabilityVariables = {
  requestId: string
}

export function createObservabilityMiddleware(
  logger: Logger,
  sentry: Pick<SentryBridge, 'setRequestId'>,
) {
  return createMiddleware<{ Variables: ObservabilityVariables }>(async (context, next) => {
    const requestId = context.get('requestId')
    const startedAt = performance.now()
    sentry.setRequestId(requestId)

    await next()

    const route = context.req.routePath || context.req.path
    logger.info({
      requestId,
      method: context.req.method,
      route,
      status: context.res.status,
      duration: Math.round(performance.now() - startedAt),
    })
  })
}
