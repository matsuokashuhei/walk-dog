import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import * as Sentry from '@sentry/hono/node'
import { sentry } from '@sentry/hono/node'
import { secureHeaders } from 'hono/secure-headers'
import { type Logger } from './observability/logger.js'
import { createRequestLoggerMiddleware } from './observability/request-middleware.js'

type Variables = {
  requestId: string
  logger: Logger
}

export type App = OpenAPIHono<{ Variables: Variables }>

export type AppDependencies = {
  logger: Logger
  setRequestId: (requestId: string) => void
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

const validationErrorHook: NonNullable<App['defaultHook']> = (result, context) => {
  if (result.success) {
    return
  }
  return context.json({
    code: 'INVALID_INPUT',
    message: '入力内容を確認してください。',
    requestId: context.get('requestId'),
    retryable: false,
  }, 400)
}

export const createApp = (
  dependencies: AppDependencies,
  registerRoutes?: (app: App) => void,
): App => {
  const app = new OpenAPIHono<{ Variables: Variables }>({
    defaultHook: validationErrorHook,
  })
  app.openAPIRegistry.register('Error', errorSchema)
  if (Sentry.getClient()) {
    app.use('*', sentry(app))
  }
  app.use('*', async (context, next) => {
    const requestId = context.req.header('X-Request-Id') ?? crypto.randomUUID()
    context.set('requestId', requestId)
    dependencies.setRequestId(requestId)
    await next()
    context.header('X-Request-Id', requestId)
  })
  app.use('*', secureHeaders())
  app.use('*', createRequestLoggerMiddleware(dependencies.logger))
  app.notFound((context) => context.json({
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
    requestId: context.get('requestId'),
    retryable: false,
  }, 404))
  app.onError((_error, context) => context.json({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
    requestId: context.get('requestId'),
    retryable: false,
  }, 500))
  app.openapi(healthRoute, (context) => context.json({ status: 'ok' }, 200))
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'walk / dog API', version: '0.1.0' },
  })
  registerRoutes?.(app)
  return app
}
