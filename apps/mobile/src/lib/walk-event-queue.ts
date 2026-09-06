import type { LocalWalkEvent } from './walk-event-schema.ts'

export type { LocalWalkEvent }

export type EventPostResult =
  | { ok: true }
  | { ok: false; status: number; retryable: boolean }

export type EventQueueAction = 'ok' | 'retry' | 'drop'

export type EventCoordinatorDeps = {
  loadQueue: () => Promise<LocalWalkEvent[]>
  saveQueue: (events: LocalWalkEvent[]) => Promise<void>
  post: (event: LocalWalkEvent) => Promise<EventPostResult>
}

function createLock() {
  let tail: Promise<void> = Promise.resolve()
  function acquire<T>(work: () => Promise<T>): Promise<T> {
    const run = tail.then(work, work)
    tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
  return { acquire }
}

function nextQueueAction(error: { status: number; retryable: boolean }): 'retry' | 'drop' {
  if (error.retryable) {
    return 'retry'
  }
  return 'drop'
}

export function createEventCoordinator(deps: EventCoordinatorDeps) {
  const lock = createLock()

  async function postOne(event: LocalWalkEvent): Promise<EventQueueAction> {
    const result = await deps.post(event)
    if (result.ok) {
      return 'ok'
    }
    return nextQueueAction(result)
  }

  async function enqueueUnlocked(event: LocalWalkEvent): Promise<EventQueueAction> {
    const queue = await deps.loadQueue()
    await deps.saveQueue([...queue, event])
    const action = await postOne(event)
    if (action === 'ok' || action === 'drop') {
      const remaining = (await deps.loadQueue()).filter((item) => item.eventId !== event.eventId)
      await deps.saveQueue(remaining)
    }
    return action
  }

  async function retryFailedUnlocked(): Promise<EventQueueAction> {
    const queue = await deps.loadQueue()
    const remaining: LocalWalkEvent[] = []
    let sawRetry = false
    for (const item of queue) {
      const action = await postOne(item)
      if (action === 'ok' || action === 'drop') {
        continue
      }
      remaining.push(item)
      sawRetry = true
    }
    await deps.saveQueue(remaining)
    if (sawRetry) {
      return 'retry'
    }
    return 'ok'
  }

  async function enqueue(event: LocalWalkEvent): Promise<EventQueueAction> {
    return lock.acquire(() => enqueueUnlocked(event))
  }

  async function retryFailed(): Promise<EventQueueAction> {
    return lock.acquire(() => retryFailedUnlocked())
  }

  async function failed(): Promise<LocalWalkEvent[]> {
    return lock.acquire(() => deps.loadQueue())
  }

  return { enqueue, retryFailed, failed }
}
