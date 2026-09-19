import assert from 'node:assert/strict'
import test from 'node:test'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'
import { createUpdateOwnerDisplayName } from '../../../../src/modules/owners/use-cases/update-owner-display-name.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-14T06:40:11.000Z'),
}

test('updateOwnerDisplayName persists displayName for the cognito subject', async () => {
  const calls: Array<{ cognitoSubject: string; displayName: string }> = []
  const owners: OwnerRepository = {
    async resolveByCognitoSubject() {
      throw new Error('unexpected resolveByCognitoSubject')
    },
    async updateDisplayName(cognitoSubject, displayName) {
      calls.push({ cognitoSubject, displayName })
      return owner
    },
  }

  const result = await createUpdateOwnerDisplayName(owners)({
    cognitoSubject: 'sub-1',
    displayName: 'Akira',
  })
  assert.equal(result, owner)
  assert.deepEqual(calls, [{ cognitoSubject: 'sub-1', displayName: 'Akira' }])
})
