import assert from 'node:assert/strict'
import test from 'node:test'
import { DogNameDuplicateError } from '../../../../src/modules/dogs/errors.js'
import type { CreateDogInput, Dog } from '../../../../src/modules/dogs/types.js'
import type { DogRepository } from '../../../../src/modules/dogs/repository.js'
import { createCreateDog } from '../../../../src/modules/dogs/use-cases/create-dog.js'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const input: CreateDogInput = {
  name: 'Mugi',
  gender: 'female',
  birthday: { precision: 'day', year: 2020, month: 4, day: 12 },
}

const dog: Dog = {
  dogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  ownerId: owner.ownerId,
  name: input.name,
  gender: input.gender,
  birthday: input.birthday,
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

function dogsFake(createWithDailyGoal: DogRepository['createWithDailyGoal']): DogRepository {
  return {
    async listByOwner() {
      throw new Error('unexpected listByOwner')
    },
    createWithDailyGoal,
    async getByOwnerAndId() {
      throw new Error('unexpected getByOwnerAndId')
    },
  }
}

test('createDog persists a dog with a daily goal after resolving the owner', async () => {
  const calls: Array<{ ownerId: string; input: CreateDogInput }> = []
  const createDog = createCreateDog(
    ownersFake(async (cognitoSubject) => {
      assert.equal(cognitoSubject, 'sub-1')
      return owner
    }),
    dogsFake(async (ownerId, createInput) => {
      calls.push({ ownerId, input: createInput })
      return dog
    }),
  )

  assert.deepEqual(
    await createDog({
      cognitoSubject: 'sub-1',
      name: input.name,
      gender: input.gender,
      birthday: input.birthday,
    }),
    { ok: true, dog },
  )
  assert.deepEqual(calls, [{ ownerId: owner.ownerId, input }])
})

test('createDog returns duplicate_name when the repository reports a duplicate name', async () => {
  const createDog = createCreateDog(
    ownersFake(async () => owner),
    dogsFake(async () => {
      throw new DogNameDuplicateError()
    }),
  )

  assert.deepEqual(
    await createDog({
      cognitoSubject: 'sub-1',
      name: input.name,
      gender: input.gender,
      birthday: input.birthday,
    }),
    { ok: false, error: 'duplicate_name' },
  )
})

test('createDog does not create a dog when owner resolution fails', async () => {
  const failure = new Error('owner lookup failed')
  const calls: string[] = []
  const createDog = createCreateDog(
    ownersFake(async () => {
      throw failure
    }),
    dogsFake(async () => {
      calls.push('createWithDailyGoal')
      return dog
    }),
  )

  await assert.rejects(
    () => createDog({
      cognitoSubject: 'sub-1',
      name: input.name,
      gender: input.gender,
      birthday: input.birthday,
    }),
    failure,
  )
  assert.deepEqual(calls, [])
})

test('createDog propagates unexpected repository errors by identity', async () => {
  const failure = new Error('insert failed')
  const createDog = createCreateDog(
    ownersFake(async () => owner),
    dogsFake(async () => {
      throw failure
    }),
  )

  await assert.rejects(
    () => createDog({
      cognitoSubject: 'sub-1',
      name: input.name,
      gender: input.gender,
      birthday: input.birthday,
    }),
    failure,
  )
})
