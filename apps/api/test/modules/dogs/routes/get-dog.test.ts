import assert from 'node:assert/strict'
import test from 'node:test'
import { getDogRoute, registerGetDogRoute } from '../../../../src/modules/dogs/routes/get-dog.js'
import type { Dog, GetDog } from '../../../../src/modules/dogs/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createDogApp } from '../fixtures.js'

assert.equal(getDogRoute.method, 'get')
assert.equal(getDogRoute.path, '/{dogId}')
assert.deepEqual(getDogRoute.security, [{ BearerAuth: [] }])

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

function createGetDogApp(
  getDog: GetDog,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: 'sub-1',
  }),
) {
  return createDogApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerGetDogRoute(routeApp, getDog)
  })
}

type ErrorBody = {
  code: string
  message: string
  requestId: string
  retryable: boolean
}

test('GET /v1/dogs/:dogId returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createGetDogApp(async () => {
    calls.push('getDog')
    return { ok: true, dog }
  }, async () => {
    throw new Error('should not verify')
  }).request(`/v1/dogs/${dog.dogId}`, {
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

test('GET /v1/dogs/:dogId returns 200 dog with currentGoal', async () => {
  const calls: Array<{ cognitoSubject: string; dogId: string }> = []
  const response = await createGetDogApp(async (input) => {
    calls.push(input)
    return { ok: true, dog }
  }).request(`/v1/dogs/${dog.dogId}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer access' },
  })
  const body = await response.json() as {
    requestId: string
    dogId: string
    name: string
    createdAt: string
    currentGoal: {
      period: string
      minutes: number
      effectiveFrom: string
      effectiveTo: string | null
    }
  }
  assert.equal(response.status, 200)
  assert.ok(body.requestId)
  assert.equal(body.dogId, dog.dogId)
  assert.equal(body.name, 'Mugi')
  assert.equal(body.createdAt, '2026-08-14T12:40:11.000Z')
  assert.equal(body.currentGoal.period, 'daily')
  assert.equal(body.currentGoal.minutes, 30)
  assert.equal(body.currentGoal.effectiveFrom, '2026-08-14T12:40:11.000Z')
  assert.equal(body.currentGoal.effectiveTo, null)
  assert.deepEqual(calls, [{ cognitoSubject: 'sub-1', dogId: dog.dogId }])
})

test('GET /v1/dogs/:dogId returns 404 NOT_FOUND when the dog is missing', async () => {
  const response = await createGetDogApp(async () => ({
    ok: false,
    error: 'not_found',
  })).request(`/v1/dogs/${dog.dogId}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer access' },
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(body.code, 'NOT_FOUND')
  assert.equal(body.message, 'The requested resource was not found.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})

test('GET /v1/dogs/:dogId returns 404 NOT_FOUND for a non-UUID dogId', async () => {
  const calls: string[] = []
  const response = await createGetDogApp(async () => {
    calls.push('getDog')
    throw new Error('getDog should not run for a non-UUID dogId')
  }).request('/v1/dogs/not-a-uuid', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer access' },
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(body.code, 'NOT_FOUND')
  assert.equal(body.message, 'The requested resource was not found.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})
