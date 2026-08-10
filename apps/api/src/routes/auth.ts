import type { App } from '../app.js'
import type { CognitoClient } from '../auth/cognito.js'
import type { DbInstance } from '../db/client.js'
import { registerSignInRoute } from './sign-in.js'
import { registerSignInVerifyRoute } from './sign-in-verify.js'
import { registerSignUpRoute } from './sign-up.js'
import { registerVerifyRoute } from './verify.js'

export type { CognitoClient }

export function registerAuthRoutes(app: App, database: DbInstance, cognito: CognitoClient): void {
  registerSignUpRoute(app, cognito)
  registerVerifyRoute(app, database, cognito)
  registerSignInRoute(app, cognito)
  registerSignInVerifyRoute(app, database, cognito)
}
