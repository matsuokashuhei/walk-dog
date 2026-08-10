import { z } from '@hono/zod-openapi'
import { errorSchema } from '../contracts/error.js'

export { errorSchema as authErrorSchema }

const ownerResponseSchema = z.object({
  ownerId: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const authenticationResponseSchema = z.object({
  requestId: z.string(),
  accessToken: z.string(),
  idToken: z.string(),
  refreshToken: z.string(),
  owner: ownerResponseSchema,
})
