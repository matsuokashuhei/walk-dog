import { doublePrecision, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { walks } from './walk.js'

export const walkTrackPoints = pgTable('walk_track_points', {
  trackPointId: uuid('track_point_id').primaryKey().$default(() => uuidv7()),
  walkId: uuid('walk_id').notNull().references(() => walks.walkId),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('walk_track_points_walk_id_recorded_at_unique').on(table.walkId, table.recordedAt),
])
