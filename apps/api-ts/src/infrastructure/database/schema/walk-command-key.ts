import { pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { owners } from './owner.js'
import { walks } from './walk.js'

export const walkCommandNamespaceEnum = pgEnum('walk_command_namespace', ['start', 'finish'])

export const walkCommandKeys = pgTable('walk_command_keys', {
  walkCommandKeyId: uuid('walk_command_key_id').primaryKey().$default(() => uuidv7()),
  ownerId: uuid('owner_id').notNull().references(() => owners.ownerId),
  namespace: walkCommandNamespaceEnum('namespace').notNull(),
  key: text('key').notNull(),
  bodyHash: text('body_hash').notNull(),
  walkId: uuid('walk_id').notNull().references(() => walks.walkId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('walk_command_keys_owner_id_namespace_key_unique').on(table.ownerId, table.namespace, table.key),
])
