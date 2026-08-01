import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import pino from 'pino'
import { secureHeaders } from 'hono/secure-headers'
import { type Logger } from './observability/logger.js'
import { createObservabilityMiddleware } from './observability/request-middleware.js'
import { createNoopSentryBridge, type SentryBridge } from './observability/sentry.js'

type Variables = { requestId: string }

export type App = OpenAPIHono<{ Variables: Variables }>

export type AppDependencies = {
  logger?: Logger
  sentry?: Pick<SentryBridge, 'setRequestId' | 'captureException'>
}

const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  retryable: z.boolean(),
})

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ status: z.literal('ok') }) } },
      description: 'API process health state',
      headers: {
        'X-Request-Id': {
          description: 'Request identifier for this response',
          schema: { type: 'string' },
        },
      },
    },
    500: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'API processing error',
    },
  },
})

export const createApp = (
  registerRoutes?: (app: App) => void,
  dependencies: AppDependencies = {},
): App => {
  const logger = dependencies.logger ?? pino({
    level: 'silent',
    base: {
      service: 'api',
      environment: 'test',
      release: 'test',
    },
  })
  const sentry = dependencies.sentry ?? createNoopSentryBridge()
  const app = new OpenAPIHono<{ Variables: Variables }>()
  app.openAPIRegistry.register('Error', errorSchema)
  app.use('*', async (context, next) => {
    const requestId = context.req.header('X-Request-Id') ?? crypto.randomUUID()
    context.set('requestId', requestId)
    await next()
    context.header('X-Request-Id', requestId)
  })
  app.use('*', secureHeaders())
  app.use('*', createObservabilityMiddleware(logger, sentry))
  app.notFound((context) => context.json({
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
    requestId: context.get('requestId'),
    retryable: false,
  }, 404))
  app.onError((error, context) => {
    sentry.captureException(error)
    return context.json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId: context.get('requestId'),
      retryable: false,
    }, 500)
  })
  app.openapi(healthRoute, (context) => context.json({ status: 'ok' }, 200))
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'walk / dog API', version: '0.1.0' },
  })
  registerRoutes?.(app)
  return app
}
