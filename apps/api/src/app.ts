import { OpenAPIHono } from '@hono/zod-openapi'
import * as Sentry from '@sentry/hono/node'
import { sentry } from '@sentry/hono/node'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import type { Logger } from './infrastructure/observability/logger.js'
import { createRequestLoggerMiddleware } from './infrastructure/observability/request-middleware.js'
import { errorSchema } from './shared/http/error-contract.js'
import type { App, AppVariables } from './shared/http/types.js'

export type AppDependencies = {
  logger: Logger
  setRequestId: (requestId: string) => void
}

export type ModuleRoute = {
  path: string
  app: App
}

const invalidInputBody = (requestId: string) => ({
  code: 'INVALID_INPUT' as const,
  message: '入力内容を確認してください。',
  requestId,
  retryable: false as const,
})

const validationErrorHook: NonNullable<App['defaultHook']> = (result, context) => {
  if (result.success) {
    return
  }
  return context.json(invalidInputBody(context.get('requestId')), 400)
}

function registerOpenApiComponents(app: App) {
  app.openAPIRegistry.register('Error', errorSchema)
  app.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  })
}

export const createApp = (
  dependencies: AppDependencies,
  routes: ModuleRoute[],
): App => {
  const app = new OpenAPIHono<{ Variables: AppVariables }>({
    defaultHook: validationErrorHook,
  })
  registerOpenApiComponents(app)
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
  app.onError((error, context) => {
    if (error instanceof HTTPException && error.status === 400) {
      return context.json(invalidInputBody(context.get('requestId')), 400)
    }
    return context.json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId: context.get('requestId'),
      retryable: false,
    }, 500)
  })
  for (const route of routes) {
    app.route(route.path, route.app)
  }
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'walk / dog API', version: '0.1.0' },
  })
  return app
}
