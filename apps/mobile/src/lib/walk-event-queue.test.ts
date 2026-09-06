import assert from 'node:assert/strict'
import test from 'node:test'
import { localWalkEventSchema, type LocalWalkEvent } from './walk-event-schema.ts'
import { createEventCoordinator } from './walk-event-queue.ts'

const event: LocalWalkEvent = {
  eventId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  participantDogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  type: 'pee',
  occurredAt: '2026-09-06T03:20:11.000Z',
  latitude: 35.681236,
  longitude: 139.767125,
}

const otherEvent: LocalWalkEvent = {
  ...event,
  eventId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e91',
  type: 'poop',
  occurredAt: '2026-09-06T03:21:11.000Z',
}

test('LocalWalkEvent schema accepts API values and rejects an invalid type', () => {
  assert.equal(localWalkEventSchema.safeParse(event).success, true)
  assert.equal(localWalkEventSchema.safeParse({ ...event, type: 'bark' }).success, false)
  assert.equal(localWalkEventSchema.safeParse({ ...event, eventId: 'evt-1' }).success, false)
  assert.equal(localWalkEventSchema.safeParse({ ...event, latitude: 91 }).success, false)
})

function memoryCoordinator(
  post: (
    input: LocalWalkEvent,
  ) => Promise<{ ok: true } | { ok: false; status: number; retryable: boolean }>,
) {
  const queue: LocalWalkEvent[] = []
  const store = createEventCoordinator({
    loadQueue: async () => queue,
    saveQueue: async (events) => {
      queue.splice(0, queue.length, ...events)
    },
    post,
  })
  return { store, queue }
}

test('successful post removes the event from the failed set', async () => {
  const { store, queue } = memoryCoordinator(async () => ({ ok: true as const }))
  assert.equal(await store.enqueue(event), 'ok')
  assert.deepEqual(queue, [])
  assert.deepEqual(await store.failed(), [])
})

test('retryable failure keeps the same event payload for manual retry', async () => {
  let posts = 0
  const { store, queue } = memoryCoordinator(async (input) => {
    posts += 1
    assert.deepEqual(input, event)
    return { ok: false as const, status: 500, retryable: true }
  })
  assert.equal(await store.enqueue(event), 'retry')
  assert.deepEqual(queue, [event])
  assert.deepEqual(await store.failed(), [event])

  assert.equal(await store.retryFailed(), 'retry')
  assert.equal(posts, 2)
  assert.deepEqual(queue, [event])
  assert.deepEqual(await store.failed(), [event])
})

test('manual retry succeeds and clears the failed set', async () => {
  let allowPost = false
  const { store, queue } = memoryCoordinator(async () => {
    if (!allowPost) {
      return { ok: false as const, status: 503, retryable: true }
    }
    return { ok: true as const }
  })
  assert.equal(await store.enqueue(event), 'retry')
  assert.deepEqual(queue, [event])
  allowPost = true
  assert.equal(await store.retryFailed(), 'ok')
  assert.deepEqual(queue, [])
  assert.deepEqual(await store.failed(), [])
})

test('non-retryable failure drops the event from the queue', async () => {
  const { store, queue } = memoryCoordinator(async () => ({
    ok: false as const,
    status: 409,
    retryable: false,
  }))
  assert.equal(await store.enqueue(event), 'drop')
  assert.deepEqual(queue, [])
  assert.deepEqual(await store.failed(), [])
})

test('retryFailed posts every failed event with the original payload', async () => {
  const posted: LocalWalkEvent[] = []
  const { store, queue } = memoryCoordinator(async (input) => {
    posted.push(input)
    return { ok: false as const, status: 500, retryable: true }
  })
  await store.enqueue(event)
  await store.enqueue(otherEvent)
  assert.deepEqual(queue, [event, otherEvent])
  posted.length = 0
  assert.equal(await store.retryFailed(), 'retry')
  assert.deepEqual(posted, [event, otherEvent])
  assert.deepEqual(queue, [event, otherEvent])
})

test('enqueue does not auto-retry later without retryFailed', async () => {
  let posts = 0
  const { store } = memoryCoordinator(async () => {
    posts += 1
    return { ok: false as const, status: 500, retryable: true }
  })
  await store.enqueue(event)
  assert.equal(posts, 1)
  await store.enqueue(otherEvent)
  assert.equal(posts, 2)
})
