import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTrackPointCoordinator,
  type LocalTrackPoint,
} from './walk-track-point-queue'

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
  let posts = 0
  const { store, path, queue } = memoryCoordinator(async () => {
    posts += 1
    return { ok: false as const, status: 401, retryable: false }
  })
  const action = await store.record(point)
  assert.equal(action, 'unauthenticated')
  assert.deepEqual(path, [point])
  assert.deepEqual(queue, [point])
  assert.equal((await store.pending()).length, 1)
  await store.record(laterPoint)
  assert.equal(posts, 1)
  assert.deepEqual(queue, [point, laterPoint])
})
