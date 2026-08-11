import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Logger } from 'pino'

export type AppVariables = {
  requestId: string
  logger: Logger
}

export type App = OpenAPIHono<{ Variables: AppVariables }>
