import { and, asc, eq, inArray } from 'drizzle-orm'
import {
  ActiveWalkExistsError,
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../modules/walks/errors.js'
import type { WalkRepositorySatisfiesActiveWalkCommands } from '../../../modules/walks/active-walk-commands.js'
import { paceSecondsPerMeter } from '../../../modules/walks/path-distance.js'
import type {
  CommandNamespace,
  CompletedWalk,
  FinishWalkInput,
  RecordingWalk,
  StartWalkInput,
  WalkEvent,
  WalkParticipant,
} from '../../../modules/walks/types.js'
import type { DbInstance } from '../client.js'
import { isUniqueViolation, uniqueConstraint } from '../unique-violation.js'
import { dogs } from '../schema/dog.js'
import { walkCommandKeys } from '../schema/walk-command-key.js'
import { walkEvents } from '../schema/walk-event.js'
import { walkParticipants } from '../schema/walk-participant.js'
import { walkTrackPoints } from '../schema/walk-track-point.js'
import { walks } from '../schema/walk.js'
import { acceptWalkTrackPoint } from './accept-track-point.js'
import { recordWalkEvent } from './record-event.js'

type WalkRow = typeof walks.$inferSelect
type WalkParticipantRow = typeof walkParticipants.$inferSelect
type WalkCommandKeyRow = typeof walkCommandKeys.$inferSelect
type WalkDb = Pick<DbInstance, 'select' | 'insert' | 'update'>

const RECORDING_UNIQUE = 'walks_owner_id_recording_unique'
const COMMAND_KEY_UNIQUE = 'walk_command_keys_owner_id_namespace_key_unique'

export function createDrizzleWalkRepository(database: DbInstance): WalkRepositorySatisfiesActiveWalkCommands {
  return {
    getActiveByOwner: (ownerId) => getActiveByOwner(database, ownerId),
    getCompletedByOwner: (input) => getCompletedByOwner(database, input),
    start: (input) => startWithRecovery(database, input),
    finish: (input) => finishWithRecovery(database, input),
    fail: (input) => failWalk(database, input),
    failIfPresent: (input) => failIfPresent(database, input),
    acceptTrackPoint: (input) => acceptWalkTrackPoint(database, input),
    listAcceptedRecordedAt: (input) => listAcceptedRecordedAt(database, input),
    listEvents: (input) => listEvents(database, input),
    recordEvent: (input) => recordWalkEvent(database, input),
  }
}

async function startWithRecovery(database: DbInstance, input: StartWalkInput): Promise<RecordingWalk> {
  try {
    return await database.transaction((trx) => startWalk(trx, input))
  } catch (error) {
    throwIfRecordingUnique(error)
    if (isCommandKeyUnique(error)) {
      return replayRecordingWalk(database, input)
    }
    throw error
  }
}

async function finishWithRecovery(database: DbInstance, input: FinishWalkInput): Promise<CompletedWalk> {
  try {
    return await database.transaction((trx) => finishWalk(trx, input))
  } catch (error) {
    throwIfRecordingUnique(error)
    if (isCommandKeyUnique(error)) {
      return replayCompletedWalk(database, input)
    }
    throw error
  }
}

async function getActiveByOwner(database: WalkDb, ownerId: string): Promise<RecordingWalk | null> {
  const walkRows = await database
    .select()
    .from(walks)
    .where(and(eq(walks.ownerId, ownerId), eq(walks.state, 'recording')))
  if (walkRows.length === 0) {
    return null
  }
  return toRecordingWalk(walkRows[0], await selectParticipants(database, walkRows[0].walkId))
}

async function getCompletedByOwner(
  database: WalkDb,
  input: { ownerId: string; walkId: string },
): Promise<CompletedWalk> {
  const walkRow = await selectOwnedWalk(database, input.ownerId, input.walkId)
  if (walkRow.state !== 'completed') {
    throw new WalkNotFoundError()
  }
  return toCompletedWalk(walkRow, await selectParticipants(database, input.walkId))
}

async function listEvents(database: WalkDb, input: { walkId: string }): Promise<WalkEvent[]> {
  const rows = await database
    .select()
    .from(walkEvents)
    .where(eq(walkEvents.walkId, input.walkId))
    .orderBy(asc(walkEvents.occurredAt))
  return rows.map(toWalkEvent)
}

async function startWalk(trx: WalkDb, input: StartWalkInput): Promise<RecordingWalk> {
  const existing = await resolveCommand(trx, input.ownerId, 'start', input.idempotencyKey, input.bodyHash)
  if (existing) {
    return loadRecordingWalk(trx, existing.walkId)
  }
  const names = await selectDogNames(trx, input.ownerId, input.participantDogIds)
  const walkRow = await insertRecordingWalk(trx, input.ownerId)
  const participantRows = await insertParticipants(trx, walkRow.walkId, input.participantDogIds, names)
  await rememberCommand(trx, input.ownerId, 'start', input.idempotencyKey, input.bodyHash, walkRow.walkId)
  return toRecordingWalk(walkRow, participantRows)
}

async function finishWalk(trx: WalkDb, input: FinishWalkInput): Promise<CompletedWalk> {
  const existing = await resolveCommand(trx, input.ownerId, 'finish', input.idempotencyKey, input.bodyHash)
  if (existing) {
    return loadCompletedWalk(trx, existing.walkId)
  }
  const walkRow = await selectOwnedWalk(trx, input.ownerId, input.walkId)
  if (walkRow.state !== 'recording') {
    throw new WalkNotRecordingError()
  }
  const completedAt = new Date()
  const updatedWalks = await trx
    .update(walks)
    .set({ state: 'completed', completedAt, distanceMeters: input.distanceMeters })
    .where(and(eq(walks.walkId, input.walkId), eq(walks.ownerId, input.ownerId), eq(walks.state, 'recording')))
    .returning()
  if (updatedWalks.length === 0) {
    throw new WalkNotRecordingError()
  }
  const participantRows = await selectParticipants(trx, input.walkId)
  await rememberCommand(trx, input.ownerId, 'finish', input.idempotencyKey, input.bodyHash, input.walkId)
  return toCompletedWalk(updatedWalks[0], participantRows)
}

async function failWalk(database: WalkDb, input: { ownerId: string; walkId: string }): Promise<void> {
  const updatedWalks = await database
    .update(walks)
    .set({ state: 'failed' })
    .where(and(eq(walks.walkId, input.walkId), eq(walks.ownerId, input.ownerId), eq(walks.state, 'recording')))
    .returning()
  if (updatedWalks.length > 0) {
    return
  }
  const walkRow = await selectOwnedWalk(database, input.ownerId, input.walkId)
  if (walkRow.state === 'failed') {
    return
  }
  throw new WalkNotRecordingError()
}

async function listAcceptedRecordedAt(
  database: WalkDb,
  input: { ownerId: string; walkId: string },
): Promise<Date[]> {
  const walkRow = await selectOwnedWalk(database, input.ownerId, input.walkId)
  if (walkRow.state !== 'recording') {
    throw new WalkNotRecordingError()
  }
  const rows = await database
    .select({ recordedAt: walkTrackPoints.recordedAt })
    .from(walkTrackPoints)
    .where(eq(walkTrackPoints.walkId, input.walkId))
    .orderBy(asc(walkTrackPoints.recordedAt))
  return rows.map((row) => row.recordedAt)
}

async function failIfPresent(database: WalkDb, input: { ownerId: string }): Promise<void> {
  await database
    .update(walks)
    .set({ state: 'failed' })
    .where(and(eq(walks.ownerId, input.ownerId), eq(walks.state, 'recording')))
}

async function replayRecordingWalk(database: WalkDb, input: StartWalkInput): Promise<RecordingWalk> {
  const existing = await resolveCommand(database, input.ownerId, 'start', input.idempotencyKey, input.bodyHash)
  if (existing) {
    return loadRecordingWalk(database, existing.walkId)
  }
  throw new IdempotencyConflictError()
}

async function replayCompletedWalk(database: WalkDb, input: FinishWalkInput): Promise<CompletedWalk> {
  const existing = await resolveCommand(database, input.ownerId, 'finish', input.idempotencyKey, input.bodyHash)
  if (existing) {
    return loadCompletedWalk(database, existing.walkId)
  }
  throw new IdempotencyConflictError()
}

async function resolveCommand(
  database: WalkDb,
  ownerId: string,
  namespace: CommandNamespace,
  key: string,
  bodyHash: string,
): Promise<WalkCommandKeyRow | undefined> {
  const rows = await database
    .select()
    .from(walkCommandKeys)
    .where(
      and(
        eq(walkCommandKeys.ownerId, ownerId),
        eq(walkCommandKeys.namespace, namespace),
        eq(walkCommandKeys.key, key),
      ),
    )
  if (rows.length === 0) {
    return undefined
  }
  if (rows[0].bodyHash !== bodyHash) {
    throw new IdempotencyConflictError()
  }
  return rows[0]
}

async function selectDogNames(database: WalkDb, ownerId: string, dogIds: string[]): Promise<string[]> {
  const rows = await database
    .select()
    .from(dogs)
    .where(and(eq(dogs.ownerId, ownerId), inArray(dogs.dogId, dogIds)))
  const nameByDogId = new Map(rows.map((row) => [row.dogId, row.name]))
  return dogIds.map((dogId) => {
    const name = nameByDogId.get(dogId)
    if (name === undefined) {
      throw new WalkNotFoundError()
    }
    return name
  })
}

async function insertRecordingWalk(trx: WalkDb, ownerId: string): Promise<WalkRow> {
  const inserted = await trx
    .insert(walks)
    .values({ ownerId, state: 'recording', startedAt: new Date(), completedAt: null })
    .returning()
  return inserted[0]
}

async function insertParticipants(
  trx: WalkDb,
  walkId: string,
  dogIds: string[],
  names: string[],
): Promise<WalkParticipantRow[]> {
  return trx
    .insert(walkParticipants)
    .values(dogIds.map((dogId, position) => ({ walkId, dogId, name: names[position], position })))
    .returning()
}

async function rememberCommand(
  trx: WalkDb,
  ownerId: string,
  namespace: CommandNamespace,
  key: string,
  bodyHash: string,
  walkId: string,
): Promise<void> {
  await trx.insert(walkCommandKeys).values({ ownerId, namespace, key, bodyHash, walkId }).returning()
}

async function selectOwnedWalk(database: WalkDb, ownerId: string, walkId: string): Promise<WalkRow> {
  const rows = await database
    .select()
    .from(walks)
    .where(and(eq(walks.walkId, walkId), eq(walks.ownerId, ownerId)))
  if (rows.length === 0) {
    throw new WalkNotFoundError()
  }
  return rows[0]
}

async function loadRecordingWalk(database: WalkDb, walkId: string): Promise<RecordingWalk> {
  return toRecordingWalk(await selectWalk(database, walkId), await selectParticipants(database, walkId))
}

async function loadCompletedWalk(database: WalkDb, walkId: string): Promise<CompletedWalk> {
  return toCompletedWalk(await selectWalk(database, walkId), await selectParticipants(database, walkId))
}

async function selectWalk(database: WalkDb, walkId: string): Promise<WalkRow> {
  const rows = await database.select().from(walks).where(eq(walks.walkId, walkId))
  return rows[0]
}

async function selectParticipants(database: WalkDb, walkId: string): Promise<WalkParticipantRow[]> {
  return database
    .select()
    .from(walkParticipants)
    .where(eq(walkParticipants.walkId, walkId))
    .orderBy(asc(walkParticipants.position))
}

function toRecordingWalk(walk: WalkRow, participantRows: WalkParticipantRow[]): RecordingWalk {
  return {
    walkId: walk.walkId,
    ownerId: walk.ownerId,
    state: 'recording',
    startedAt: walk.startedAt,
    completedAt: null,
    participants: participantRows.map(toParticipant),
  }
}

function toCompletedWalk(walk: WalkRow, participantRows: WalkParticipantRow[]): CompletedWalk {
  const completedAt = walk.completedAt as Date
  const durationSeconds = Math.floor((completedAt.getTime() - walk.startedAt.getTime()) / 1000)
  const distanceMeters = walk.distanceMeters ?? 0
  return {
    walkId: walk.walkId,
    ownerId: walk.ownerId,
    state: 'completed',
    startedAt: walk.startedAt,
    completedAt,
    durationSeconds,
    distanceMeters,
    paceSecondsPerMeter: paceSecondsPerMeter(durationSeconds, distanceMeters),
    participants: participantRows.map(toParticipant),
  }
}

function toParticipant(row: WalkParticipantRow): WalkParticipant {
  return { walkParticipantId: row.walkParticipantId, dogId: row.dogId, name: row.name }
}

function toWalkEvent(row: typeof walkEvents.$inferSelect): WalkEvent {
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

function throwIfRecordingUnique(error: unknown): void {
  if (isUniqueViolation(error) && uniqueConstraint(error) === RECORDING_UNIQUE) {
    throw new ActiveWalkExistsError()
  }
}

function isCommandKeyUnique(error: unknown): boolean {
  return isUniqueViolation(error) && uniqueConstraint(error) === COMMAND_KEY_UNIQUE
}
