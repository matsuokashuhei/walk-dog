import { structuredLogger } from '@hono/structured-logger'
import type { Logger } from './logger.js'

export function createRequestLoggerMiddleware(rootLogger: Logger) {
  return structuredLogger({
    createLogger: (context) => rootLogger.child({ requestId: context.get('requestId') }),
    onRequest: () => undefined,
    onResponse: (logger, context, elapsedMs) => {
      logger.info({
        method: context.req.method,
        route: context.req.routePath || context.req.path,
        status: context.res.status,
        duration: Math.round(elapsedMs),
      })
    },
  })
}
