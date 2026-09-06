import { ApiError } from './api.ts'
import type { EventPostResult } from './walk-event-queue.ts'
import { postEvent, type LocalWalkEvent } from './walk-api.ts'

export function toEventPostResult(error: unknown): EventPostResult {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { ok: false, status: 401, retryable: true }
    }
    return { ok: false, status: error.status, retryable: error.retryable }
  }
  return { ok: false, status: 0, retryable: true }
}

export async function postWalkEvent(
  accessToken: string,
  event: LocalWalkEvent,
): Promise<EventPostResult> {
  try {
    await postEvent(accessToken, event.walkId, {
      eventId: event.eventId,
      participantDogId: event.participantDogId,
      type: event.type,
      occurredAt: event.occurredAt,
      latitude: event.latitude,
      longitude: event.longitude,
    })
    return { ok: true }
  } catch (error) {
    return toEventPostResult(error)
  }
}
