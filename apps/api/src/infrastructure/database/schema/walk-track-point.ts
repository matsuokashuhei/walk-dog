import { numeric, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { walks } from './walk.js'

export const latitudeSchema = z.number()
  .gte(-99.999999)
  .lte(99.999999)
  .multipleOf(0.000001)
  .brand<'numeric(8, 6)'>()

export const longitudeSchema = z.number()
  .gte(-999.999999)
  .lte(999.999999)
  .multipleOf(0.000001)
  .brand<'numeric(9, 6)'>()

export type Latitude = z.infer<typeof latitudeSchema>
export type Longitude = z.infer<typeof longitudeSchema>

export const walkTrackPoints = pgTable('walk_track_points', {
  trackPointId: uuid('track_point_id').primaryKey().$default(() => uuidv7()),
  walkId: uuid('walk_id').notNull().references(() => walks.walkId),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  latitude: numeric('latitude', { precision: 8, scale: 6, mode: 'number' }).notNull().$type<Latitude>(),
  longitude: numeric('longitude', { precision: 9, scale: 6, mode: 'number' }).notNull().$type<Longitude>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('walk_track_points_walk_id_recorded_at_unique').on(table.walkId, table.recordedAt),
])
