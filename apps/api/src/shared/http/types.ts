import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Logger } from 'pino'
import type { Principal } from '../../infrastructure/cognito/access-token-verifier.js'

export type AppVariables = {
  requestId: string
  logger: Logger
  principal: Principal
}

export type App = OpenAPIHono<{ Variables: AppVariables }>
