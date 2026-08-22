import assert from 'node:assert/strict'
import test from 'node:test'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'
import type { WalkRepository } from '../../../../src/modules/walks/repository.js'
import type { RecordingWalk } from '../../../../src/modules/walks/types.js'
import { createGetActiveWalk } from '../../../../src/modules/walks/use-cases/get-active-walk.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const walk: RecordingWalk = {
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  ownerId: owner.ownerId,
  state: 'recording',
  startedAt: new Date('2026-08-15T03:12:04.000Z'),
  completedAt: null,
  participants: [
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e81',
      dogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
      name: 'Mugi',
    },
  ],
}

function ownersFake(resolve: OwnerRepository['resolveByCognitoSubject']): OwnerRepository {
  return {
    resolveByCognitoSubject: resolve,
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }
}

function walksFake(getActiveByOwner: WalkRepository['getActiveByOwner']): WalkRepository {
  return {
    getActiveByOwner,
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
  }
}

test('getActiveWalk returns the recording walk after resolving the owner', async () => {
  const calls: string[] = []
  const getActiveWalk = createGetActiveWalk(
    ownersFake(async (cognitoSubject) => {
      assert.equal(cognitoSubject, 'sub-1')
      return owner
    }),
    walksFake(async (ownerId) => {
      calls.push(ownerId)
      return walk
    }),
  )

  assert.deepEqual(await getActiveWalk('sub-1'), walk)
  assert.deepEqual(calls, [owner.ownerId])
})

test('getActiveWalk returns null when the owner has no recording walk', async () => {
  const getActiveWalk = createGetActiveWalk(
    ownersFake(async () => owner),
    walksFake(async () => null),
  )

  assert.equal(await getActiveWalk('sub-1'), null)
})

test('getActiveWalk does not look up a walk when owner resolution fails', async () => {
  const failure = new Error('owner lookup failed')
  const calls: string[] = []
  const getActiveWalk = createGetActiveWalk(
    ownersFake(async () => {
      throw failure
    }),
    walksFake(async () => {
      calls.push('getActiveByOwner')
      return walk
    }),
  )

  await assert.rejects(() => getActiveWalk('sub-1'), failure)
  assert.deepEqual(calls, [])
})

test('getActiveWalk propagates unexpected repository errors by identity', async () => {
  const failure = new Error('lookup failed')
  const getActiveWalk = createGetActiveWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw failure
    }),
  )

  await assert.rejects(() => getActiveWalk('sub-1'), failure)
})
