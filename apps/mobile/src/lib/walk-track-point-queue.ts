import type { LocalTrackPoint } from './walk-api'

export type { LocalTrackPoint }

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

export function createTrackPointCoordinator(deps: TrackPointCoordinatorDeps) {
  let autoRetry = true

  async function flush(): Promise<'ok' | 'retry' | 'drop' | 'unauthenticated'> {
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

  async function record(point: LocalTrackPoint): Promise<'ok' | 'retry' | 'drop' | 'unauthenticated'> {
    const path = await deps.loadPath()
    await deps.savePath([...path, point])
    const queue = await deps.loadQueue()
    await deps.saveQueue([...queue, point])
    return flush()
  }

  async function pending(): Promise<LocalTrackPoint[]> {
    return deps.loadQueue()
  }

  return { record, pending, flush }
}
