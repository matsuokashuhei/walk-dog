import { z } from 'zod'
import { errorSchema } from '../../shared/http/error-contract.js'

export { errorSchema as ownerErrorSchema }

export const ownerSchema = z.object({
  ownerId: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const ownerResponseSchema = ownerSchema.extend({
  requestId: z.string(),
})

export const updateOwnerRequestSchema = z.strictObject({
  displayName: z.string().trim().nonempty().max(100),
})
