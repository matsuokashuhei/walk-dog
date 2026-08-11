import { registerSignInRoute } from '../modules/auth/routes/sign-in.js'
import { registerSignUpRoute } from '../modules/auth/routes/sign-up.js'
import { registerSignInVerifyRoute } from './sign-in-verify.js'
import { registerSignUpVerifyRoute } from './sign-up-verify.js'

export {
  registerSignInRoute,
  registerSignInVerifyRoute,
  registerSignUpRoute,
  registerSignUpVerifyRoute,
}
