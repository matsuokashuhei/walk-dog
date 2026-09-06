import { numeric, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { dogs } from './dog.js'
import { walks } from './walk.js'

export const walkEventTypeEnum = pgEnum('walk_event_type', ['pee', 'poop', 'sniff', 'greet'])

export const walkEvents = pgTable('walk_events', {
  eventId: uuid('event_id').primaryKey(),
  walkId: uuid('walk_id').notNull().references(() => walks.walkId),
  participantDogId: uuid('participant_dog_id').notNull().references(() => dogs.dogId),
  type: walkEventTypeEnum('type').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  latitude: numeric('latitude', { precision: 8, scale: 6, mode: 'number' }).notNull(),
  longitude: numeric('longitude', { precision: 9, scale: 6, mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type WalkEvent = typeof walkEvents.$inferSelect
export type NewWalkEvent = typeof walkEvents.$inferInsert
