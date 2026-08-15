import { z } from 'zod'
import { errorSchema } from '../../shared/http/error-contract.js'

export { errorSchema as dogErrorSchema }

const birthdaySchema = z.discriminatedUnion('precision', [
  z.object({ precision: z.literal('unknown') }),
  z.object({ precision: z.literal('year'), year: z.number().int() }),
  z.object({
    precision: z.literal('month'),
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
  }),
  z.object({
    precision: z.literal('day'),
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
])

export const createDogRequestSchema = z.strictObject({
  name: z.string().trim().nonempty().max(100),
  gender: z.enum(['male', 'female', 'unknown']),
  birthday: birthdaySchema.optional(),
})

const currentGoalSchema = z.object({
  goalRevisionId: z.string(),
  period: z.literal('daily'),
  minutes: z.number(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
})

const dogSchema = z.object({
  dogId: z.string(),
  ownerId: z.string(),
  name: z.string(),
  gender: z.enum(['male', 'female', 'unknown']),
  birthday: birthdaySchema,
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  currentGoal: currentGoalSchema,
})

export const dogResponseSchema = dogSchema.extend({
  requestId: z.string(),
})

export const dogListResponseSchema = z.object({
  requestId: z.string(),
  dogs: z.array(dogSchema),
})

export const dogIdParamSchema = z.object({
  dogId: z.uuid(),
})
