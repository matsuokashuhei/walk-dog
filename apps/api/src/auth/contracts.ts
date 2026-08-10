import { z } from '@hono/zod-openapi'

export const authErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  retryable: z.boolean(),
})

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
