import { pgTable, pgEnum, uuid, integer, timestamp } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { dogs } from './dog.js'

export const goalPeriodEnum = pgEnum('goal_period', ['daily', 'weekly'])

export const goalRevisions = pgTable('goal_revisions', {
  goalRevisionId: uuid('goal_revision_id').primaryKey().$default(() => uuidv7()),
  dogId: uuid('dog_id').notNull().references(() => dogs.dogId),
  period: goalPeriodEnum('period').notNull(),
  minutes: integer('minutes').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
