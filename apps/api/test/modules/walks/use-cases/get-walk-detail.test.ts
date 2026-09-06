import assert from 'node:assert/strict'
import test from 'node:test'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'
import { WalkNotFoundError } from '../../../../src/modules/walks/errors.js'
import type { ConfirmedTrackPoint, ConfirmedTrackPoints } from '../../../../src/modules/walks/provider.js'
import type { WalkRepository } from '../../../../src/modules/walks/repository.js'
import type { CompletedWalk, WalkEvent } from '../../../../src/modules/walks/types.js'
import { createGetWalkDetail } from '../../../../src/modules/walks/use-cases/get-walk-detail.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'
const participantDogId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70'

const completedWalk: CompletedWalk = {
  walkId,
  ownerId: owner.ownerId,
  state: 'completed',
  startedAt: new Date('2026-09-06T03:12:04.000Z'),
  completedAt: new Date('2026-09-06T03:44:04.000Z'),
  durationSeconds: 1920,
  distanceMeters: 2100,
  paceSecondsPerMeter: 1920 / 2100,
  participants: [
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e81',
      dogId: participantDogId,
      name: 'Mugi',
    },
  ],
}

const trackPoints: ConfirmedTrackPoint[] = [
  {
    recordedAt: new Date('2026-09-06T03:12:14.000Z'),
    latitude: 35.6812,
    longitude: 139.7671,
  },
  {
    recordedAt: new Date('2026-09-06T03:12:24.000Z'),
    latitude: 35.6815,
    longitude: 139.7674,
  },
]

const events: WalkEvent[] = [
  {
    eventId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e91',
    walkId,
    participantDogId,
    type: 'poop',
    occurredAt: new Date('2026-09-06T03:30:00.000Z'),
    latitude: 35.6814,
    longitude: 139.7673,
  },
  {
    eventId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
    walkId,
    participantDogId,
    type: 'pee',
    occurredAt: new Date('2026-09-06T03:20:11.000Z'),
    latitude: 35.681236,
    longitude: 139.767125,
  },
]

const detailInput = {
  cognitoSubject: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  walkId,
}

function ownersFake(resolve: OwnerRepository['resolveByCognitoSubject']): OwnerRepository {
  return {
    resolveByCognitoSubject: resolve,
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }
}

function walksFake(opts: {
  getCompletedByOwner: WalkRepository['getCompletedByOwner']
  listEvents: WalkRepository['listEvents']
}): WalkRepository {
  return {
    async getActiveByOwner() {
      throw new Error('unexpected getActiveByOwner')
    },
    async start() {
      throw new Error('unexpected start')
    },
    async finish() {
      throw new Error('unexpected finish')
    },
    async fail() {
      throw new Error('unexpected fail')
    },
    async failIfPresent() {
      throw new Error('unexpected failIfPresent')
    },
    async acceptTrackPoint() {
      throw new Error('unexpected acceptTrackPoint')
    },
    async listAcceptedRecordedAt() {
      throw new Error('unexpected listAcceptedRecordedAt')
    },
    async recordEvent() {
      throw new Error('unexpected recordEvent')
    },
    getCompletedByOwner: opts.getCompletedByOwner,
    listEvents: opts.listEvents,
  }
}

function confirmedFake(listPoints: ConfirmedTrackPoints['listPoints']): ConfirmedTrackPoints {
  return {
    listPoints,
    async listRecordedAt() {
      throw new Error('unexpected listRecordedAt')
    },
  }
}

function createSut(opts: {
  getCompletedByOwner?: WalkRepository['getCompletedByOwner']
  listEvents?: WalkRepository['listEvents']
  listPoints?: ConfirmedTrackPoints['listPoints']
  resolveByCognitoSubject?: OwnerRepository['resolveByCognitoSubject']
} = {}) {
  const getCompletedCalls: Array<{ ownerId: string; walkId: string }> = []
  const listEventsCalls: Array<{ walkId: string }> = []
  const listPointsCalls: string[] = []
  const getWalkDetail = createGetWalkDetail(
    ownersFake(opts.resolveByCognitoSubject ?? (async (cognitoSubject) => {
      assert.equal(cognitoSubject, detailInput.cognitoSubject)
      return owner
    })),
    walksFake({
      async getCompletedByOwner(input) {
        getCompletedCalls.push(input)
        if (opts.getCompletedByOwner) {
          return opts.getCompletedByOwner(input)
        }
        return completedWalk
      },
      async listEvents(input) {
        listEventsCalls.push(input)
        if (opts.listEvents) {
          return opts.listEvents(input)
        }
        return events
      },
    }),
    confirmedFake(async (id) => {
      listPointsCalls.push(id)
      if (opts.listPoints) {
        return opts.listPoints(id)
      }
      return trackPoints
    }),
  )
  return { getWalkDetail, getCompletedCalls, listEventsCalls, listPointsCalls }
}

test('getWalkDetail returns completed walk with track points and events', async () => {
  const { getWalkDetail, getCompletedCalls, listEventsCalls, listPointsCalls } = createSut()
  assert.deepEqual(await getWalkDetail(detailInput), {
    ok: true,
    detail: {
      ...completedWalk,
      trackPoints,
      events,
    },
  })
  assert.deepEqual(getCompletedCalls, [{ ownerId: owner.ownerId, walkId }])
  assert.deepEqual(listPointsCalls, [walkId])
  assert.deepEqual(listEventsCalls, [{ walkId }])
})

test('getWalkDetail returns empty arrays when there are no points or events', async () => {
  const { getWalkDetail } = createSut({
    async listPoints() {
      return []
    },
    async listEvents() {
      return []
    },
  })
  assert.deepEqual(await getWalkDetail(detailInput), {
    ok: true,
    detail: {
      ...completedWalk,
      trackPoints: [],
      events: [],
    },
  })
})

test('getWalkDetail returns not_found and skips points and events', async () => {
  const { getWalkDetail, listEventsCalls, listPointsCalls } = createSut({
    async getCompletedByOwner() {
      throw new WalkNotFoundError()
    },
  })
  assert.deepEqual(await getWalkDetail(detailInput), {
    ok: false,
    error: 'not_found',
  })
  assert.deepEqual(listPointsCalls, [])
  assert.deepEqual(listEventsCalls, [])
})

test('getWalkDetail propagates unexpected repository errors', async () => {
  const { getWalkDetail } = createSut({
    async getCompletedByOwner() {
      throw new Error('db down')
    },
  })
  await assert.rejects(() => getWalkDetail(detailInput), (error: Error) => {
    assert.equal(error.message, 'db down')
    return true
  })
})
