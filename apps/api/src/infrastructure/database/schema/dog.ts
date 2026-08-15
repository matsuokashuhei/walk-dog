import { pgTable, pgEnum, uuid, text, jsonb, timestamp, unique } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { owners } from './owner.js'

export const dogGenderEnum = pgEnum('dog_gender', ['male', 'female', 'unknown'])

export const dogs = pgTable('dogs', {
  dogId: uuid('dog_id').primaryKey().$default(() => uuidv7()),
  ownerId: uuid('owner_id').notNull().references(() => owners.ownerId),
  name: text('name').notNull(),
  gender: dogGenderEnum('gender').notNull(),
  birthday: jsonb('birthday').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  unique('dogs_owner_id_name_unique').on(table.ownerId, table.name),
])
