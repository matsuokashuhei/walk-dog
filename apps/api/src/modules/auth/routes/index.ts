import { OpenAPIHono } from '@hono/zod-openapi'
import type { AccessTokenVerifier } from '../../../shared/http/access-token.js'
import { createAuthenticationMiddleware } from '../../../shared/http/authentication-middleware.js'
import type { App, AppVariables } from '../../../shared/http/types.js'
import type {
  SignOut,
  StartSignIn,
  StartSignUp,
  VerifySignIn,
  VerifySignUp,
} from '../types.js'
import { registerSignInRoute } from './sign-in.js'
import { registerSignInVerifyRoute } from './sign-in-verify.js'
import { registerSignOutRoute } from './sign-out.js'
import { registerSignUpRoute } from './sign-up.js'
import { registerSignUpVerifyRoute } from './sign-up-verify.js'

export type AuthRouteDependencies = {
  startSignUp: StartSignUp
  verifySignUp: VerifySignUp
  startSignIn: StartSignIn
  verifySignIn: VerifySignIn
  signOut: SignOut
  accessTokenVerifier: AccessTokenVerifier
}

export function registerAuthRoutes(dependencies: AuthRouteDependencies): App {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  registerSignUpRoute(app, dependencies.startSignUp)
  registerSignUpVerifyRoute(app, dependencies.verifySignUp)
  registerSignInRoute(app, dependencies.startSignIn)
  registerSignInVerifyRoute(app, dependencies.verifySignIn)
  app.use('/sign-out', createAuthenticationMiddleware(dependencies.accessTokenVerifier))
  registerSignOutRoute(app, dependencies.signOut)
  return app
}
