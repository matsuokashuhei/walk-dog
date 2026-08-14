import assert from 'node:assert/strict'
import test from 'node:test'
import { listDogsRoute, registerListDogsRoute } from '../../../../src/modules/dogs/routes/list-dogs.js'
import type { Dog, ListDogs } from '../../../../src/modules/dogs/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createDogApp } from '../fixtures.js'

assert.equal(listDogsRoute.method, 'get')
assert.equal(listDogsRoute.path, '/')
assert.deepEqual(listDogsRoute.security, [{ BearerAuth: [] }])

const dog: Dog = {
  dogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  ownerId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e6f',
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

function createListDogsApp(
  listDogs: ListDogs,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: 'sub-1',
  }),
) {
  return createDogApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerListDogsRoute(routeApp, listDogs)
  })
}

type ErrorBody = {
  code: string
  message: string
  requestId: string
  retryable: boolean
}

test('GET /v1/dogs returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createListDogsApp(async () => {
    calls.push('listDogs')
    return []
  }, async () => {
    throw new Error('should not verify')
  }).request('/v1/dogs', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 401)
  assert.equal(body.code, 'UNAUTHENTICATED')
  assert.equal(body.message, 'Authentication is required.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('GET /v1/dogs returns 200 with an empty dogs array', async () => {
  const calls: string[] = []
  const response = await createListDogsApp(async (cognitoSubject) => {
    calls.push(cognitoSubject)
    return []
  }).request('/v1/dogs', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer access' },
  })
  const body = await response.json() as { requestId: string; dogs: unknown[] }
  assert.equal(response.status, 200)
  assert.ok(body.requestId)
  assert.deepEqual(body.dogs, [])
  assert.deepEqual(calls, ['sub-1'])
})

test('GET /v1/dogs returns 200 dogs with ISO currentGoal dates', async () => {
  const response = await createListDogsApp(async () => [dog]).request('/v1/dogs', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer access' },
  })
  const body = await response.json() as {
    requestId: string
    dogs: Array<{
      dogId: string
      ownerId: string
      name: string
      gender: string
      birthday: Dog['birthday']
      avatarUrl: string | null
      createdAt: string
      updatedAt: string
      currentGoal: {
        goalRevisionId: string
        period: string
        minutes: number
        effectiveFrom: string
        effectiveTo: string | null
      }
    }>
  }
  assert.equal(response.status, 200)
  assert.ok(body.requestId)
  assert.equal(body.dogs.length, 1)
  assert.equal(body.dogs[0]?.dogId, dog.dogId)
  assert.equal(body.dogs[0]?.ownerId, dog.ownerId)
  assert.equal(body.dogs[0]?.name, 'Mugi')
  assert.equal(body.dogs[0]?.gender, 'female')
  assert.deepEqual(body.dogs[0]?.birthday, dog.birthday)
  assert.equal(body.dogs[0]?.avatarUrl, null)
  assert.equal(body.dogs[0]?.createdAt, '2026-08-14T12:40:11.000Z')
  assert.equal(body.dogs[0]?.updatedAt, '2026-08-14T12:40:11.000Z')
  assert.equal(body.dogs[0]?.currentGoal.period, 'daily')
  assert.equal(body.dogs[0]?.currentGoal.minutes, 30)
  assert.equal(body.dogs[0]?.currentGoal.effectiveFrom, '2026-08-14T12:40:11.000Z')
  assert.equal(body.dogs[0]?.currentGoal.effectiveTo, null)
})
