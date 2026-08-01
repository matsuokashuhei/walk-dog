import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const owners = pgTable('owners', {
  id: uuid('id').defaultRandom().primaryKey(),
  cognitoSubject: text('cognito_subject').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
