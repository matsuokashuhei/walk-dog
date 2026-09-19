import { asc, eq } from 'drizzle-orm'
import type { WalkEvent } from '../../../modules/walks/types.js'
import type { DbInstance } from '../client.js'
import { walkEvents } from '../schema/walk-event.js'
import { toWalkEvent } from './walk-mappers.js'

type WalkDb = Pick<DbInstance, 'select' | 'insert' | 'update'>

export async function listWalkEvents(
  database: WalkDb,
  input: { walkId: string },
): Promise<WalkEvent[]> {
  const rows = await database
    .select()
    .from(walkEvents)
    .where(eq(walkEvents.walkId, input.walkId))
    .orderBy(asc(walkEvents.occurredAt))
  return rows.map(toWalkEvent)
}
