import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'

export const owners = pgTable('owners', {
  ownerId: uuid('owner_id').primaryKey().$default(() => uuidv7()),
  cognitoSubject: text('cognito_subject').notNull().unique(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})
