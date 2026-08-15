import assert from 'node:assert/strict'
import test from 'node:test'
import { dogs } from '../../../src/infrastructure/database/schema/dog.js'
import { goalRevisions } from '../../../src/infrastructure/database/schema/goal-revision.js'

test('dogs table has the expected columns', () => {
  const columns = Object.keys(dogs)
  for (const key of ['dogId', 'ownerId', 'name', 'gender', 'birthday', 'createdAt', 'updatedAt']) {
    assert.ok(columns.includes(key), key)
  }
})

test('goal_revisions table has the expected columns', () => {
  const columns = Object.keys(goalRevisions)
  for (const key of ['goalRevisionId', 'dogId', 'period', 'minutes', 'effectiveFrom', 'effectiveTo', 'createdAt']) {
    assert.ok(columns.includes(key), key)
  }
})
