import { z } from 'zod'
import { errorSchema } from '../../shared/http/error-contract.js'
import { ownerSchema } from '../owners/contracts.js'

export { errorSchema as authErrorSchema }

export const signUpRequestSchema = z.object({ email: z.email() })

export const signUpResponseSchema = z.object({
  requestId: z.string(),
  username: z.string(),
  session: z.string().nullable(),
  codeDelivery: z.object({ destination: z.string(), attribute: z.string() }).nullable(),
})

export const signInRequestSchema = z.object({ email: z.email() })

export const signInResponseSchema = z.object({
  requestId: z.string(),
  username: z.string(),
  session: z.string().nonempty(),
  codeDelivery: z.object({ destination: z.string(), attribute: z.string() }),
})

export const signUpVerifyRequestSchema = z.object({
  username: z.string().nonempty(),
  session: z.string().nonempty().nullable(),
  code: z.string().nonempty(),
})

export const signInVerifyRequestSchema = z.object({
  username: z.string().nonempty(),
  session: z.string().nonempty(),
  code: z.string().nonempty(),
})

export const authenticationResponseSchema = z.object({
  requestId: z.string(),
  accessToken: z.string(),
  idToken: z.string(),
  refreshToken: z.string(),
  owner: ownerSchema,
})

export const signOutRequestSchema = z.strictObject({})
