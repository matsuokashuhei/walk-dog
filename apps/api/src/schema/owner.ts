import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const owners = pgTable('owners', {
  ownerId: uuid('owner_id').primaryKey().defaultRandom(),
  cognitoSubject: text('cognito_subject').notNull().unique(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})
