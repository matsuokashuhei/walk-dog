import assert from 'node:assert/strict'
import test from 'node:test'
import type { Dog } from '../../../../src/modules/dogs/types.js'
import type { DogRepository } from '../../../../src/modules/dogs/repository.js'
import { createGetDog } from '../../../../src/modules/dogs/use-cases/get-dog.js'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const dog: Dog = {
  dogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  ownerId: owner.ownerId,
  name: 'Mugi',
  gender: 'female',
  birthday: { precision: 'day', year: 2020, month: 4, day: 12 },
  avatarUrl: null,
  createdAt: new Date('2026-08-14T12:40:11.000Z'),
  updatedAt: new Date('2026-08-14T12:40:11.000Z'),
  currentGoal: {
    goalRevisionId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e71',
    period: 'daily',
    minutes: 30,
    effectiveFrom: new Date('2026-08-14T12:40:11.000Z'),
    effectiveTo: null,
  },
}

function ownersFake(resolve: OwnerRepository['resolveByCognitoSubject']): OwnerRepository {
  return {
    resolveByCognitoSubject: resolve,
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }
}

function dogsFake(getByOwnerAndId: DogRepository['getByOwnerAndId']): DogRepository {
  return {
    async listByOwner() {
      throw new Error('unexpected listByOwner')
    },
    async createWithDailyGoal() {
      throw new Error('unexpected createWithDailyGoal')
    },
    getByOwnerAndId,
  }
}

test('getDog returns the dog after resolving the owner', async () => {
  const calls: Array<{ ownerId: string; dogId: string }> = []
  const getDog = createGetDog(
    ownersFake(async (cognitoSubject) => {
      assert.equal(cognitoSubject, 'sub-1')
      return owner
    }),
    dogsFake(async (ownerId, dogId) => {
      calls.push({ ownerId, dogId })
      return dog
    }),
  )

  assert.deepEqual(await getDog({ cognitoSubject: 'sub-1', dogId: dog.dogId }), { ok: true, dog })
  assert.deepEqual(calls, [{ ownerId: owner.ownerId, dogId: dog.dogId }])
})

test('getDog returns not_found when the repository returns null', async () => {
  const getDog = createGetDog(
    ownersFake(async () => owner),
    dogsFake(async () => null),
  )

  assert.deepEqual(
    await getDog({ cognitoSubject: 'sub-1', dogId: dog.dogId }),
    { ok: false, error: 'not_found' },
  )
})

test('getDog does not look up a dog when owner resolution fails', async () => {
  const failure = new Error('owner lookup failed')
  const calls: string[] = []
  const getDog = createGetDog(
    ownersFake(async () => {
      throw failure
    }),
    dogsFake(async () => {
      calls.push('getByOwnerAndId')
      return dog
    }),
  )

  await assert.rejects(() => getDog({ cognitoSubject: 'sub-1', dogId: dog.dogId }), failure)
  assert.deepEqual(calls, [])
})

test('getDog propagates unexpected repository errors by identity', async () => {
  const failure = new Error('lookup failed')
  const getDog = createGetDog(
    ownersFake(async () => owner),
    dogsFake(async () => {
      throw failure
    }),
  )

  await assert.rejects(() => getDog({ cognitoSubject: 'sub-1', dogId: dog.dogId }), failure)
})
