import type { App } from '../app.js'
import type { CognitoClient } from '../auth/cognito.js'
import type { DbInstance } from '../db/client.js'
import { registerSignInRoute } from './sign-in.js'
import { registerSignInVerifyRoute } from './sign-in-verify.js'
import { registerSignUpRoute } from './sign-up.js'
import { registerSignUpVerifyRoute } from './sign-up-verify.js'

export function registerAuthRoutes(app: App, database: DbInstance, cognito: CognitoClient): void {
  registerSignUpRoute(app, cognito)
  registerSignUpVerifyRoute(app, database, cognito)
  registerSignInRoute(app, cognito)
  registerSignInVerifyRoute(app, database, cognito)
}
