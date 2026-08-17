import type { LocalTrackPoint } from './walk-api'

export type { LocalTrackPoint }

export const SAMPLE_INTERVAL_MS = 10_000

export type TrackPointPostResult =
  | { ok: true }
  | { ok: false; status: number; retryable: boolean }

export type TrackPointCoordinatorDeps = {
  loadPath: () => Promise<LocalTrackPoint[]>
  savePath: (points: LocalTrackPoint[]) => Promise<void>
  loadQueue: () => Promise<LocalTrackPoint[]>
  saveQueue: (points: LocalTrackPoint[]) => Promise<void>
  post: (point: LocalTrackPoint) => Promise<TrackPointPostResult>
}

export function nextQueueAction(error: {
  status: number
  retryable: boolean
}): 'retry' | 'drop' | 'unauthenticated' {
  if (error.status === 401) {
    return 'unauthenticated'
  }
  if (error.retryable) {
    return 'retry'
  }
  return 'drop'
}

export function isSampleDue(lastRecordedAt: string | null, recordedAt: string): boolean {
  if (lastRecordedAt === null) {
    return true
  }
  return Date.parse(recordedAt) - Date.parse(lastRecordedAt) >= SAMPLE_INTERVAL_MS
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

export function createTrackPointCoordinator(deps: TrackPointCoordinatorDeps) {
  let autoRetry = true
  const lock = createLock()

  async function flushUnlocked(): Promise<'ok' | 'retry' | 'drop' | 'unauthenticated'> {
    const queue = await deps.loadQueue()
    if (!autoRetry) {
      return 'unauthenticated'
    }
    const remaining: LocalTrackPoint[] = []
    for (const item of queue) {
      if (!autoRetry) {
        remaining.push(item)
        continue
      }
      const result = await deps.post(item)
      if (result.ok) {
        continue
      }
      const action = nextQueueAction(result)
      if (action === 'drop') {
        continue
      }
      remaining.push(item)
      if (action === 'unauthenticated') {
        autoRetry = false
      }
    }
    await deps.saveQueue(remaining)
    if (!autoRetry) {
      return 'unauthenticated'
    }
    if (remaining.length > 0) {
      return 'retry'
    }
    return 'ok'
  }

  async function recordUnlocked(
    point: LocalTrackPoint,
  ): Promise<'ok' | 'retry' | 'drop' | 'unauthenticated'> {
    const path = await deps.loadPath()
    const lastRecordedAt = path.at(-1)?.recordedAt ?? null
    if (!isSampleDue(lastRecordedAt, point.recordedAt)) {
      return flushUnlocked()
    }
    await deps.savePath([...path, point])
    const queue = await deps.loadQueue()
    await deps.saveQueue([...queue, point])
    return flushUnlocked()
  }

  async function record(point: LocalTrackPoint): Promise<'ok' | 'retry' | 'drop' | 'unauthenticated'> {
    return lock.acquire(() => recordUnlocked(point))
  }

  async function flush(): Promise<'ok' | 'retry' | 'drop' | 'unauthenticated'> {
    return lock.acquire(() => flushUnlocked())
  }

  async function pending(): Promise<LocalTrackPoint[]> {
    return lock.acquire(() => deps.loadQueue())
  }

  return { record, pending, flush }
}
