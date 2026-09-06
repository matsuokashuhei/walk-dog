import { sql } from 'drizzle-orm'
import { integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { owners } from './owner.js'

export const walkStateEnum = pgEnum('walk_state', ['recording', 'completed', 'failed'])

export const walks = pgTable('walks', {
  walkId: uuid('walk_id').primaryKey().$default(() => uuidv7()),
  ownerId: uuid('owner_id').notNull().references(() => owners.ownerId),
  state: walkStateEnum('state').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  distanceMeters: integer('distance_meters'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('walks_owner_id_recording_unique').on(table.ownerId).where(sql`${table.state} = 'recording'`),
])
