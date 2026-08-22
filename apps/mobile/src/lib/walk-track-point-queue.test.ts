import assert from 'node:assert/strict'
import test from 'node:test'
import type { LocalTrackPoint } from './walk-api'
import {
  createTrackPointCoordinator,
} from './walk-track-point-queue'

const SAMPLE_NOW_MS = Date.parse('2026-08-17T03:12:14.000Z')

const point: LocalTrackPoint = {
  walkId: 'w1',
  recordedAt: '2026-08-17T03:12:14.000Z',
  latitude: 35.68,
  longitude: 139.76,
}

const laterPoint: LocalTrackPoint = {
  walkId: 'w1',
  recordedAt: '2026-08-17T03:12:24.000Z',
  latitude: 35.681,
  longitude: 139.761,
}

function memoryCoordinator(
  post: (input: LocalTrackPoint) => Promise<
    { ok: true } | { ok: false; status: number; retryable: boolean }
  >,
  now: () => number = () => SAMPLE_NOW_MS,
) {
  const path: LocalTrackPoint[] = []
  const queue: LocalTrackPoint[] = []
  const store = createTrackPointCoordinator({
    loadPath: async () => path,
    savePath: async (points) => {
      path.splice(0, path.length, ...points)
    },
    loadQueue: async () => queue,
    saveQueue: async (points) => {
      queue.splice(0, queue.length, ...points)
    },
    post,
    now,
  })
  return { store, path, queue }
}

test('201 removes the point from the outbound queue and keeps it on the path', async () => {
  const path: LocalTrackPoint[] = []
  const queue: LocalTrackPoint[] = []
  const store = createTrackPointCoordinator({
    loadPath: async () => path,
    savePath: async (points) => {
      path.splice(0, path.length, ...points)
    },
    loadQueue: async () => queue,
    saveQueue: async (points) => {
      queue.splice(0, queue.length, ...points)
    },
    post: async () => ({ ok: true as const }),
    now: () => SAMPLE_NOW_MS,
  })
  await store.record(point)
  assert.deepEqual(path, [point])
  assert.deepEqual(queue, [])
})

test('retryable failure keeps the same point in the queue', async () => {
  const { store, path, queue } = memoryCoordinator(async () => ({
    ok: false as const,
    status: 500,
    retryable: true,
  }))
  await store.record(point)
  assert.equal((await store.pending()).length, 1)
  assert.deepEqual(queue, [point])
  assert.deepEqual(path, [point])
})

test('409 conflict is dropped from the queue', async () => {
  const { store, path, queue } = memoryCoordinator(async () => ({
    ok: false as const,
    status: 409,
    retryable: false,
  }))
  await store.record(point)
  assert.deepEqual(path, [point])
  assert.deepEqual(queue, [])
  assert.equal((await store.pending()).length, 0)
})

test('401 is unauthenticated and stops auto-retry', async () => {
  let now = SAMPLE_NOW_MS
  let posts = 0
  const { store, path, queue } = memoryCoordinator(async () => {
    posts += 1
    return { ok: false as const, status: 401, retryable: false }
  }, () => now)
  const action = await store.record(point)
  assert.equal(action, 'unauthenticated')
  assert.deepEqual(path, [point])
  assert.deepEqual(queue, [point])
  assert.equal((await store.pending()).length, 1)
  now = SAMPLE_NOW_MS + 10_000
  await store.record(laterPoint)
  assert.equal(posts, 1)
  assert.deepEqual(queue, [point, laterPoint])
})

test('does not record a point sooner than 10 seconds', async () => {
  let now = SAMPLE_NOW_MS
  const { store, path, queue } = memoryCoordinator(async () => ({ ok: true as const }), () => now)
  await store.record(point)
  now = SAMPLE_NOW_MS + 5_000
  const tooSoon: LocalTrackPoint = {
    walkId: 'w1',
    recordedAt: '2026-08-17T03:12:19.000Z',
    latitude: 35.69,
    longitude: 139.76,
  }
  await store.record(tooSoon)
  assert.deepEqual(path, [point])
  assert.deepEqual(queue, [])
  now = SAMPLE_NOW_MS + 10_000
  await store.record(laterPoint)
  assert.deepEqual(path, [point, laterPoint])
})

test('records a still GPS fix when 10s have elapsed on the wall clock', async () => {
  let now = SAMPLE_NOW_MS
  const path: LocalTrackPoint[] = []
  const queue: LocalTrackPoint[] = []
  const store = createTrackPointCoordinator({
    loadPath: async () => path,
    savePath: async (points) => {
      path.splice(0, path.length, ...points)
    },
    loadQueue: async () => queue,
    saveQueue: async (points) => {
      queue.splice(0, queue.length, ...points)
    },
    post: async () => ({ ok: true as const }),
    now: () => now,
  })
  await store.record(point)
  now = SAMPLE_NOW_MS + 10_000
  await store.record(point)
  assert.deepEqual(path, [point, { ...point, recordedAt: laterPoint.recordedAt }])
  assert.deepEqual(queue, [])
})

test('stamps recordedAt from the sample clock, not the GPS timestamp', async () => {
  const now = SAMPLE_NOW_MS
  const gpsStale: LocalTrackPoint = {
    walkId: 'w1',
    recordedAt: '2026-08-17T01:00:00.000Z',
    latitude: 35.68,
    longitude: 139.76,
  }
  const { store, path } = memoryCoordinator(async () => ({ ok: true as const }), () => now)
  await store.record(gpsStale)
  assert.equal(path[0]?.recordedAt, '2026-08-17T03:12:14.000Z')
})

test('overlapping records keep both points on the path', async () => {
  let now = SAMPLE_NOW_MS
  let pathSaves = 0
  let releaseFirstSave!: () => void
  const firstSave = new Promise<void>((resolve) => {
    releaseFirstSave = resolve
  })
  const path: LocalTrackPoint[] = []
  const queue: LocalTrackPoint[] = []
  const store = createTrackPointCoordinator({
    loadPath: async () => path,
    savePath: async (points) => {
      pathSaves += 1
      if (pathSaves === 1) {
        await firstSave
      }
      path.splice(0, path.length, ...points)
    },
    loadQueue: async () => queue,
    saveQueue: async (points) => {
      queue.splice(0, queue.length, ...points)
    },
    post: async () => ({ ok: true as const }),
    now: () => now,
  })
  const first = store.record(point)
  while (pathSaves === 0) {
    await Promise.resolve()
  }
  now = SAMPLE_NOW_MS + 10_000
  const second = store.record(laterPoint)
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
  releaseFirstSave()
  await Promise.all([first, second])
  assert.deepEqual(path, [point, laterPoint])
  assert.deepEqual(queue, [])
})
