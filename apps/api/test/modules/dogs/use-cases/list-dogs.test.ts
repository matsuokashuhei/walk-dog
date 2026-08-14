import assert from 'node:assert/strict'
import test from 'node:test'
import type { Dog } from '../../../../src/modules/dogs/types.js'
import type { DogRepository } from '../../../../src/modules/dogs/repository.js'
import { createListDogs } from '../../../../src/modules/dogs/use-cases/list-dogs.js'
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

function dogsFake(listByOwner: DogRepository['listByOwner']): DogRepository {
  return {
    listByOwner,
    async createWithDailyGoal() {
      throw new Error('unexpected createWithDailyGoal')
    },
    async getByOwnerAndId() {
      throw new Error('unexpected getByOwnerAndId')
    },
  }
}

test('listDogs returns the owner dogs after resolving the cognito subject', async () => {
  const calls: string[] = []
  const listDogs = createListDogs(
    ownersFake(async (cognitoSubject) => {
      calls.push(`owner:${cognitoSubject}`)
      return owner
    }),
    dogsFake(async (ownerId) => {
      calls.push(`dogs:${ownerId}`)
      return [dog]
    }),
  )

  assert.deepEqual(await listDogs('sub-1'), [dog])
  assert.deepEqual(calls, ['owner:sub-1', `dogs:${owner.ownerId}`])
})

test('listDogs returns an empty array when the owner has no dogs', async () => {
  const listDogs = createListDogs(
    ownersFake(async () => owner),
    dogsFake(async () => []),
  )

  assert.deepEqual(await listDogs('sub-1'), [])
})

test('listDogs does not list dogs when owner resolution fails', async () => {
  const failure = new Error('owner lookup failed')
  const calls: string[] = []
  const listDogs = createListDogs(
    ownersFake(async () => {
      throw failure
    }),
    dogsFake(async () => {
      calls.push('listByOwner')
      return []
    }),
  )

  await assert.rejects(() => listDogs('sub-1'), failure)
  assert.deepEqual(calls, [])
})

test('listDogs propagates unexpected dog repository errors by identity', async () => {
  const failure = new Error('list failed')
  const listDogs = createListDogs(
    ownersFake(async () => owner),
    dogsFake(async () => {
      throw failure
    }),
  )

  await assert.rejects(() => listDogs('sub-1'), failure)
})
