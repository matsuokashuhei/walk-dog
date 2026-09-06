import assert from 'node:assert/strict'
import test from 'node:test'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'
import {
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../../src/modules/walks/errors.js'
import type { WalkRepository } from '../../../../src/modules/walks/repository.js'
import { createDeleteWalk } from '../../../../src/modules/walks/use-cases/delete-walk.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'

function ownersFake(resolve: OwnerRepository['resolveByCognitoSubject']): OwnerRepository {
  return {
    resolveByCognitoSubject: resolve,
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }
}

function walksFake(fail: WalkRepository['fail']): WalkRepository {
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
    fail,
    async failIfPresent() {
      throw new Error('unexpected failIfPresent')
    },
    async acceptTrackPoint() {
      throw new Error('unexpected acceptTrackPoint')
    },
    async listAcceptedRecordedAt() {
      throw new Error('unexpected listAcceptedRecordedAt')
    },
  }
}

test('deleteWalk fails the walk after resolving the owner', async () => {
  const calls: Array<{ ownerId: string; walkId: string }> = []
  const deleteWalk = createDeleteWalk(
    ownersFake(async (cognitoSubject) => {
      assert.equal(cognitoSubject, 'sub-1')
      return owner
    }),
    walksFake(async (input) => {
      calls.push(input)
    }),
  )

  assert.deepEqual(
    await deleteWalk({
      cognitoSubject: 'sub-1',
      walkId,
    }),
    { ok: true },
  )
  assert.deepEqual(calls, [{ ownerId: owner.ownerId, walkId }])
})

test('deleteWalk returns not_found when the walk is missing', async () => {
  const deleteWalk = createDeleteWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new WalkNotFoundError()
    }),
  )

  assert.deepEqual(
    await deleteWalk({
      cognitoSubject: 'sub-1',
      walkId,
    }),
    { ok: false, error: 'not_found' },
  )
})

test('deleteWalk returns walk_not_recording when the walk is completed', async () => {
  const deleteWalk = createDeleteWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new WalkNotRecordingError()
    }),
  )

  assert.deepEqual(
    await deleteWalk({
      cognitoSubject: 'sub-1',
      walkId,
    }),
    { ok: false, error: 'walk_not_recording' },
  )
})

test('deleteWalk does not fail a walk when owner resolution fails', async () => {
  const failure = new Error('owner lookup failed')
  const calls: string[] = []
  const deleteWalk = createDeleteWalk(
    ownersFake(async () => {
      throw failure
    }),
    walksFake(async () => {
      calls.push('fail')
    }),
  )

  await assert.rejects(
    () => deleteWalk({
      cognitoSubject: 'sub-1',
      walkId,
    }),
    failure,
  )
  assert.deepEqual(calls, [])
})

test('deleteWalk propagates unexpected repository errors by identity', async () => {
  const failure = new Error('update failed')
  const deleteWalk = createDeleteWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw failure
    }),
  )

  await assert.rejects(
    () => deleteWalk({
      cognitoSubject: 'sub-1',
      walkId,
    }),
    failure,
  )
})
