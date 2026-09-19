import { and, eq } from 'drizzle-orm'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../modules/walks/errors.js'
import type { AcceptTrackPointInput, TrackPoint } from '../../../modules/walks/types.js'
import type { DbInstance } from '../client.js'
import { walkTrackPoints } from '../schema/walk-track-point.js'
import { walks } from '../schema/walk.js'
import { isUniqueViolation, uniqueConstraint } from '../unique-violation.js'

type WalkTrackPointRow = typeof walkTrackPoints.$inferSelect
type WalkDb = Pick<DbInstance, 'select' | 'insert' | 'update'>

const TRACK_POINT_UNIQUE = 'walk_track_points_walk_id_recorded_at_unique'

export async function acceptWalkTrackPoint(
  database: WalkDb,
  input: AcceptTrackPointInput,
): Promise<TrackPoint> {
  const walkRows = await database.select().from(walks).where(eq(walks.walkId, input.walkId))
  if (walkRows.length === 0 || walkRows[0].ownerId !== input.ownerId) {
    throw new WalkNotFoundError()
  }
  if (walkRows[0].state !== 'recording') {
    throw new WalkNotRecordingError()
  }
  try {
    const inserted = await database
      .insert(walkTrackPoints)
      .values({
        walkId: input.walkId,
        recordedAt: input.recordedAt,
        latitude: input.latitude,
        longitude: input.longitude,
      })
      .returning()
    return toTrackPoint(inserted[0])
  } catch (error) {
    if (!isUniqueViolation(error) || uniqueConstraint(error) !== TRACK_POINT_UNIQUE) {
      throw error
    }
    return replayAcceptedTrackPoint(database, input)
  }
}

async function replayAcceptedTrackPoint(database: WalkDb, input: AcceptTrackPointInput): Promise<TrackPoint> {
  const rows = await database
    .select()
    .from(walkTrackPoints)
    .where(and(eq(walkTrackPoints.walkId, input.walkId), eq(walkTrackPoints.recordedAt, input.recordedAt)))
  if (rows[0].latitude === input.latitude && rows[0].longitude === input.longitude) {
    return toTrackPoint(rows[0])
  }
  throw new IdempotencyConflictError()
}

function toTrackPoint(row: WalkTrackPointRow): TrackPoint {
  return {
    trackPointId: row.trackPointId,
    walkId: row.walkId,
    recordedAt: row.recordedAt,
    latitude: row.latitude,
    longitude: row.longitude,
  }
}
