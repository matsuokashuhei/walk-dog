export {
  registerAuthRoutes,
  type AuthRouteDependencies,
} from './routes/index.js'
export type { AccessTokenVerifier } from '../../infrastructure/cognito/access-token-verifier.js'
export type { SignOut } from './types.js'
