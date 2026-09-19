import { structuredLogger } from '@hono/structured-logger'
import { routePath } from 'hono/route'
import type { Logger } from './logger.js'

export function createRequestLoggerMiddleware(rootLogger: Logger) {
  return structuredLogger({
    createLogger: (context) => {
      const requestId = context.get('requestId') as string
      return rootLogger.child({ requestId })
    },
    onRequest: () => undefined,
    onResponse: (logger, context, elapsedMs) => {
      logger.info({
        method: context.req.method,
        route: routePath(context, -1) || context.req.path,
        status: context.res.status,
        duration: Math.round(elapsedMs),
      })
    },
  })
}
