import assert from 'node:assert/strict'
import test from 'node:test'
import { cognitoSubjectSchema } from '../../../src/modules/walks/types.js'

test('cognitoSubject is a UUID', () => {
  assert.equal(cognitoSubjectSchema.safeParse('0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80').success, true)
  assert.equal(cognitoSubjectSchema.safeParse('sub-1').success, false)
})
