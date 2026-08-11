import assert from 'node:assert/strict'
import test from 'node:test'
import { owners } from '../../../src/infrastructure/database/schema/owner.js'

test('owners table has the expected columns', () => {
  const columns = Object.keys(owners)

  assert.ok(columns.includes('ownerId'))
  assert.ok(columns.includes('cognitoSubject'))
  assert.ok(columns.includes('displayName'))
  assert.ok(columns.includes('createdAt'))
  assert.ok(columns.includes('updatedAt'))
})

test('owners cognitoSubject is not null', () => {
  assert.equal(owners.cognitoSubject.notNull, true)
})
