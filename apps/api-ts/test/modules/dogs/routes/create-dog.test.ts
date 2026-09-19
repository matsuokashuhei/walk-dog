import assert from 'node:assert/strict'
import test from 'node:test'
import { createDogRoute, registerCreateDogRoute } from '../../../../src/modules/dogs/routes/create-dog.js'
import type { CreateDog, Dog } from '../../../../src/modules/dogs/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createDogApp } from '../fixtures.js'

assert.equal(createDogRoute.method, 'post')
assert.equal(createDogRoute.path, '/')
assert.deepEqual(createDogRoute.security, [{ BearerAuth: [] }])

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

function createCreateDogApp(
  createDog: CreateDog,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: 'sub-1',
  }),
) {
  return createDogApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerCreateDogRoute(routeApp, createDog)
  })
}

const authorizedHeaders = {
  Authorization: 'Bearer access',
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

type ErrorBody = {
  code: string
  message: string
  requestId: string
  retryable: boolean
}

async function assertInvalidInput(response: Response, calls: unknown[]) {
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 400)
  assert.equal(body.code, 'INVALID_INPUT')
  assert.equal(body.message, '入力内容を確認してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
}

test('POST /v1/dogs returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createCreateDogApp(async () => {
    calls.push('create')
    return { ok: true, dog }
  }, async () => {
    throw new Error('should not verify')
  }).request('/v1/dogs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name: 'Mugi', gender: 'female' }),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 401)
  assert.equal(body.code, 'UNAUTHENTICATED')
  assert.equal(body.message, 'Authentication is required.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('POST /v1/dogs returns 201 with a daily 30-minute currentGoal', async () => {
  const calls: Array<{
    cognitoSubject: string
    name: string
    gender: Dog['gender']
    birthday: Dog['birthday']
  }> = []
  const response = await createCreateDogApp(async (input) => {
    calls.push(input)
    return { ok: true, dog }
  }).request('/v1/dogs', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({
      name: '  Mugi  ',
      gender: 'female',
      birthday: { precision: 'day', year: 2020, month: 4, day: 12 },
    }),
  })
  const body = await response.json() as {
    requestId: string
    dogId: string
    name: string
    gender: string
    currentGoal: { period: string; minutes: number; effectiveTo: string | null }
  }
  assert.equal(response.status, 201)
  assert.ok(body.requestId)
  assert.equal(body.dogId, dog.dogId)
  assert.equal(body.name, 'Mugi')
  assert.equal(body.gender, 'female')
  assert.equal(body.currentGoal.period, 'daily')
  assert.equal(body.currentGoal.minutes, 30)
  assert.equal(body.currentGoal.effectiveTo, null)
  assert.deepEqual(calls, [{
    cognitoSubject: 'sub-1',
    name: 'Mugi',
    gender: 'female',
    birthday: { precision: 'day', year: 2020, month: 4, day: 12 },
  }])
})

test('POST /v1/dogs treats omitted birthday as unknown precision', async () => {
  const calls: Array<{ birthday: Dog['birthday'] }> = []
  const created = {
    ...dog,
    birthday: { precision: 'unknown' as const },
  }
  const response = await createCreateDogApp(async (input) => {
    calls.push({ birthday: input.birthday })
    return { ok: true, dog: created }
  }).request('/v1/dogs', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ name: 'Mugi', gender: 'female' }),
  })
  const body = await response.json() as { birthday: Dog['birthday'] }
  assert.equal(response.status, 201)
  assert.deepEqual(body.birthday, { precision: 'unknown' })
  assert.deepEqual(calls, [{ birthday: { precision: 'unknown' } }])
})

test('POST /v1/dogs returns 400 when name is missing', async () => {
  const calls: string[] = []
  const response = await createCreateDogApp(async () => {
    calls.push('create')
    return { ok: true, dog }
  }).request('/v1/dogs', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ gender: 'female' }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/dogs returns 400 for empty name', async () => {
  const calls: string[] = []
  const response = await createCreateDogApp(async () => {
    calls.push('create')
    return { ok: true, dog }
  }).request('/v1/dogs', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ name: '', gender: 'female' }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/dogs returns 400 for whitespace-only name', async () => {
  const calls: string[] = []
  const response = await createCreateDogApp(async () => {
    calls.push('create')
    return { ok: true, dog }
  }).request('/v1/dogs', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ name: '   ', gender: 'female' }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/dogs returns 400 when name exceeds 100 characters', async () => {
  const calls: string[] = []
  const response = await createCreateDogApp(async () => {
    calls.push('create')
    return { ok: true, dog }
  }).request('/v1/dogs', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ name: 'a'.repeat(101), gender: 'female' }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/dogs returns 400 when gender is missing', async () => {
  const calls: string[] = []
  const response = await createCreateDogApp(async () => {
    calls.push('create')
    return { ok: true, dog }
  }).request('/v1/dogs', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ name: 'Mugi' }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/dogs returns 400 for unexpected body fields', async () => {
  const calls: string[] = []
  const response = await createCreateDogApp(async () => {
    calls.push('create')
    return { ok: true, dog }
  }).request('/v1/dogs', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ name: 'Mugi', gender: 'female', extra: true }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/dogs returns 400 for a malformed JSON body', async () => {
  const calls: string[] = []
  const response = await createCreateDogApp(async () => {
    calls.push('create')
    return { ok: true, dog }
  }).request('/v1/dogs', {
    method: 'POST',
    headers: authorizedHeaders,
    body: '{',
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/dogs returns 409 for a duplicate name', async () => {
  const response = await createCreateDogApp(async () => ({
    ok: false,
    error: 'duplicate_name',
  })).request('/v1/dogs', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ name: 'Mugi', gender: 'female' }),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 409)
  assert.equal(body.code, 'DOG_NAME_DUPLICATE')
  assert.equal(body.message, '同じ名前のDogが既に存在します。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})
