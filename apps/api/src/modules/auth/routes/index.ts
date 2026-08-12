import { OpenAPIHono } from '@hono/zod-openapi'
import type { App, AppVariables } from '../../../shared/http/types.js'
import type {
  StartSignIn,
  StartSignUp,
  VerifySignIn,
  VerifySignUp,
} from '../types.js'
import { registerSignInRoute } from './sign-in.js'
import { registerSignInVerifyRoute } from './sign-in-verify.js'
import { registerSignUpRoute } from './sign-up.js'
import { registerSignUpVerifyRoute } from './sign-up-verify.js'

export type AuthRouteDependencies = {
  startSignUp: StartSignUp
  verifySignUp: VerifySignUp
  startSignIn: StartSignIn
  verifySignIn: VerifySignIn
}

export function registerAuthRoutes(dependencies: AuthRouteDependencies): App {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  registerSignUpRoute(app, dependencies.startSignUp)
  registerSignUpVerifyRoute(app, dependencies.verifySignUp)
  registerSignInRoute(app, dependencies.startSignIn)
  registerSignInVerifyRoute(app, dependencies.verifySignIn)
  return app
}
