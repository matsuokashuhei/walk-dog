import assert from 'node:assert/strict'
import test from 'node:test'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'
import { createGetOwner } from '../../../../src/modules/owners/use-cases/get-owner.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: null,
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

test('getOwner returns the owner for the cognito subject', async () => {
  const calls: string[] = []
  const owners: OwnerRepository = {
    async resolveByCognitoSubject(cognitoSubject) {
      calls.push(cognitoSubject)
      return owner
    },
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }

  const result = await createGetOwner(owners)('sub-1')
  assert.equal(result, owner)
  assert.deepEqual(calls, ['sub-1'])
})
