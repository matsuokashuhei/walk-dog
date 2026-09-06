import { and, eq } from 'drizzle-orm'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../modules/walks/errors.js'
import type { RecordEventInput, WalkEvent } from '../../../modules/walks/types.js'
import type { DbInstance } from '../client.js'
import { walkEvents } from '../schema/walk-event.js'
import { walkParticipants } from '../schema/walk-participant.js'
import { walks } from '../schema/walk.js'
import { isUniqueViolation, uniqueConstraint } from '../unique-violation.js'

type WalkEventRow = typeof walkEvents.$inferSelect
type WalkDb = Pick<DbInstance, 'select' | 'insert' | 'update'>

const EVENT_PKEY = 'walk_events_pkey'

export async function recordWalkEvent(
  database: WalkDb,
  input: RecordEventInput,
): Promise<{ event: WalkEvent; created: boolean }> {
  const walkRows = await database.select().from(walks).where(eq(walks.walkId, input.walkId))
  if (walkRows.length === 0 || walkRows[0].ownerId !== input.ownerId) {
    throw new WalkNotFoundError()
  }
  if (walkRows[0].state !== 'recording') {
    throw new WalkNotRecordingError()
  }
  const participantRows = await database
    .select()
    .from(walkParticipants)
    .where(and(
      eq(walkParticipants.walkId, input.walkId),
      eq(walkParticipants.dogId, input.participantDogId),
    ))
  if (participantRows.length === 0) {
    throw new WalkNotFoundError()
  }
  try {
    const inserted = await database
      .insert(walkEvents)
      .values({
        eventId: input.eventId,
        walkId: input.walkId,
        participantDogId: input.participantDogId,
        type: input.type,
        occurredAt: input.occurredAt,
        latitude: input.latitude,
        longitude: input.longitude,
      })
      .returning()
    return { event: toWalkEvent(inserted[0]), created: true }
  } catch (error) {
    if (!isUniqueViolation(error) || uniqueConstraint(error) !== EVENT_PKEY) {
      throw error
    }
    return replayRecordedEvent(database, input)
  }
}

async function replayRecordedEvent(
  database: WalkDb,
  input: RecordEventInput,
): Promise<{ event: WalkEvent; created: boolean }> {
  const rows = await database
    .select()
    .from(walkEvents)
    .where(eq(walkEvents.eventId, input.eventId))
  const row = rows[0]
  if (
    row.participantDogId === input.participantDogId
    && row.type === input.type
    && row.occurredAt.getTime() === input.occurredAt.getTime()
    && row.latitude === input.latitude
    && row.longitude === input.longitude
  ) {
    return { event: toWalkEvent(row), created: false }
  }
  throw new IdempotencyConflictError()
}

function toWalkEvent(row: WalkEventRow): WalkEvent {
  return {
    eventId: row.eventId,
    walkId: row.walkId,
    participantDogId: row.participantDogId,
    type: row.type,
    occurredAt: row.occurredAt,
    latitude: row.latitude,
    longitude: row.longitude,
  }
}
