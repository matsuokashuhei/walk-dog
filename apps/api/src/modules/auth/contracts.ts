import { z } from 'zod'
import { errorSchema } from '../../shared/http/error-contract.js'

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
