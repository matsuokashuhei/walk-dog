import assert from 'node:assert/strict'
import test from 'node:test'
import { owners } from '../src/db/schema/index.js'

test('owners schema exposes the R0 persistence fields', () => {
  assert.deepEqual([
    owners.id.name,
    owners.cognitoSubject.name,
    owners.createdAt.name,
    owners.updatedAt.name,
  ], [
    'id', 'cognito_subject', 'created_at', 'updated_at',
  ])
})
