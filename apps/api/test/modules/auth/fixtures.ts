import { OpenAPIHono } from '@hono/zod-openapi'
import { createApp } from '../../../src/app.js'
import { setRequestIdTag } from '../../../src/infrastructure/observability/sentry.js'
import {
  registerAuthRoutes,
  type AuthRouteDependencies,
  type SignOut,
} from '../../../src/modules/auth/index.js'
import type { AccessTokenVerifier } from '../../../src/shared/http/access-token.js'
import type {
  StartSignIn,
  StartSignUp,
  VerifySignIn,
  VerifySignUp,
} from '../../../src/modules/auth/types.js'
import { registerHealthyHealthRoutes } from '../../support/health-routes.js'
import type { App, AppVariables } from '../../../src/shared/http/types.js'
import { testLogger } from '../../support/test-logger.js'

const appDependencies = { logger: testLogger, setRequestId: setRequestIdTag }

const unusedStartSignUp: StartSignUp = async () => {
  throw new Error('startSignUp should not run during auth fixture setup')
}

const unusedStartSignIn: StartSignIn = async () => {
  throw new Error('startSignIn should not run during auth fixture setup')
}

const unusedVerifySignUp: VerifySignUp = async () => {
  throw new Error('verifySignUp should not run during auth fixture setup')
}

const unusedVerifySignIn: VerifySignIn = async () => {
  throw new Error('verifySignIn should not run during auth fixture setup')
}

const unusedSignOut: SignOut = async () => {
  throw new Error('signOut should not run during auth fixture setup')
}

const unusedAccessTokenVerifier: AccessTokenVerifier = {
  async verify() {
    throw new Error('accessTokenVerifier should not run during auth fixture setup')
  },
}

export const unusedAuthRouteDependencies: AuthRouteDependencies = {
  startSignUp: unusedStartSignUp,
  verifySignUp: unusedVerifySignUp,
  startSignIn: unusedStartSignIn,
  verifySignIn: unusedVerifySignIn,
  signOut: unusedSignOut,
  accessTokenVerifier: unusedAccessTokenVerifier,
}

export function makeIdToken(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64')
  return `header.${payload}.signature`
}

export function createAuthApp(registerRoutes: (app: App) => void): App {
  const authChild = new OpenAPIHono<{ Variables: AppVariables }>()
  registerRoutes(authChild)
  return createApp(appDependencies, [
    { path: '/', app: registerHealthyHealthRoutes() },
    { path: '/v1/auth', app: authChild },
  ])
}

export function createRegisteredAuthApp(
  dependencies: AuthRouteDependencies = unusedAuthRouteDependencies,
): App {
  return createApp(appDependencies, [
    { path: '/', app: registerHealthyHealthRoutes() },
    { path: '/v1/auth', app: registerAuthRoutes(dependencies) },
  ])
}
