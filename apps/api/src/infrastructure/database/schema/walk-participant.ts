import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { dogs } from './dog.js'
import { walks } from './walk.js'

export const walkParticipants = pgTable('walk_participants', {
  walkParticipantId: uuid('walk_participant_id').primaryKey().$default(() => uuidv7()),
  walkId: uuid('walk_id').notNull().references(() => walks.walkId),
  dogId: uuid('dog_id').notNull().references(() => dogs.dogId),
  name: text('name').notNull(),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('walk_participants_walk_id_dog_id_unique').on(table.walkId, table.dogId),
])
