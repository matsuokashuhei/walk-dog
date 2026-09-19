import assert from 'node:assert/strict'
import test from 'node:test'
import {
  registerStartWalkRoute,
  startWalkRoute,
} from '../../../../src/modules/walks/routes/start-walk.js'
import type { RecordingWalk, StartWalk } from '../../../../src/modules/walks/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createWalkApp } from '../fixtures.js'

assert.equal(startWalkRoute.method, 'post')
assert.equal(startWalkRoute.path, '/')
assert.deepEqual(startWalkRoute.security, [{ BearerAuth: [] }])

const participantDogIds = [
  '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e72',
]
const idempotencyKey = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90'

const walk: RecordingWalk = {
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  ownerId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e6f',
  state: 'recording',
  startedAt: new Date('2026-08-15T03:12:04.000Z'),
  completedAt: null,
  participants: [
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e81',
      dogId: participantDogIds[0],
      name: 'Mugi',
    },
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e82',
      dogId: participantDogIds[1],
      name: 'Sora',
    },
  ],
}

function createStartWalkApp(
  startWalk: StartWalk,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: 'sub-1',
  }),
) {
  return createWalkApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerStartWalkRoute(routeApp, startWalk)
  })
}

const authorizedHeaders = {
  Authorization: 'Bearer access',
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'Idempotency-Key': idempotencyKey,
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

test('POST /v1/walks returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createStartWalkApp(async () => {
    calls.push('start')
    return { ok: true, walk }
  }, async () => {
    throw new Error('should not verify')
  }).request('/v1/walks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ participantDogIds }),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 401)
  assert.equal(body.code, 'UNAUTHENTICATED')
  assert.equal(body.message, 'Authentication is required.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('POST /v1/walks returns 201 recording walk with participants in request order', async () => {
  const calls: Array<{
    cognitoSubject: string
    participantDogIds: string[]
    idempotencyKey: string
  }> = []
  const response = await createStartWalkApp(async (input) => {
    calls.push(input)
    return { ok: true, walk }
  }).request('/v1/walks', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ participantDogIds }),
  })
  const body = await response.json() as {
    requestId: string
    walkId: string
    state: string
    completedAt: string | null
    participants: Array<{ dogId: string }>
  }
  assert.equal(response.status, 201)
  assert.ok(body.requestId)
  assert.equal(body.walkId, walk.walkId)
  assert.equal(body.state, 'recording')
  assert.equal(body.completedAt, null)
  assert.deepEqual(body.participants.map((participant) => participant.dogId), participantDogIds)
  assert.deepEqual(calls, [{
    cognitoSubject: 'sub-1',
    participantDogIds,
    idempotencyKey,
  }])
})

test('POST /v1/walks returns 201 with the same walkId for the same Idempotency-Key and body', async () => {
  const app = createStartWalkApp(async () => ({ ok: true, walk }))
  const request = {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ participantDogIds }),
  }
  const first = await app.request('/v1/walks', request)
  const second = await app.request('/v1/walks', request)
  const firstBody = await first.json() as { walkId: string }
  const secondBody = await second.json() as { walkId: string }
  assert.equal(first.status, 201)
  assert.equal(second.status, 201)
  assert.equal(firstBody.walkId, walk.walkId)
  assert.equal(secondBody.walkId, firstBody.walkId)
})

test('POST /v1/walks returns 400 when the body is missing', async () => {
  const calls: string[] = []
  const response = await createStartWalkApp(async () => {
    calls.push('start')
    return { ok: true, walk }
  }).request('/v1/walks', {
    method: 'POST',
    headers: authorizedHeaders,
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/walks returns 400 when participantDogIds is empty', async () => {
  const calls: string[] = []
  const response = await createStartWalkApp(async () => {
    calls.push('start')
    return { ok: true, walk }
  }).request('/v1/walks', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ participantDogIds: [] }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/walks returns 400 when participantDogIds contains duplicates', async () => {
  const calls: string[] = []
  const response = await createStartWalkApp(async () => {
    calls.push('start')
    return { ok: true, walk }
  }).request('/v1/walks', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ participantDogIds: [participantDogIds[0], participantDogIds[0]] }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/walks returns 400 when participantDogIds contains a non-UUID', async () => {
  const calls: string[] = []
  const response = await createStartWalkApp(async () => {
    calls.push('start')
    return { ok: true, walk }
  }).request('/v1/walks', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ participantDogIds: ['not-a-uuid'] }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/walks returns 400 for unexpected body fields', async () => {
  const calls: string[] = []
  const response = await createStartWalkApp(async () => {
    calls.push('start')
    return { ok: true, walk }
  }).request('/v1/walks', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ participantDogIds, extra: true }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/walks returns 400 for a malformed JSON body', async () => {
  const calls: string[] = []
  const response = await createStartWalkApp(async () => {
    calls.push('start')
    return { ok: true, walk }
  }).request('/v1/walks', {
    method: 'POST',
    headers: authorizedHeaders,
    body: '{',
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/walks returns 400 when Idempotency-Key is missing', async () => {
  const calls: string[] = []
  const response = await createStartWalkApp(async () => {
    calls.push('start')
    return { ok: true, walk }
  }).request('/v1/walks', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer access',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ participantDogIds }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/walks returns 400 when Idempotency-Key is empty', async () => {
  const calls: string[] = []
  const response = await createStartWalkApp(async () => {
    calls.push('start')
    return { ok: true, walk }
  }).request('/v1/walks', {
    method: 'POST',
    headers: { ...authorizedHeaders, 'Idempotency-Key': '' },
    body: JSON.stringify({ participantDogIds }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/walks returns 400 when Idempotency-Key is 257 characters', async () => {
  const calls: string[] = []
  const response = await createStartWalkApp(async () => {
    calls.push('start')
    return { ok: true, walk }
  }).request('/v1/walks', {
    method: 'POST',
    headers: { ...authorizedHeaders, 'Idempotency-Key': 'a'.repeat(257) },
    body: JSON.stringify({ participantDogIds }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/walks returns 404 NOT_FOUND when a participant dog is missing', async () => {
  const response = await createStartWalkApp(async () => ({
    ok: false,
    error: 'not_found',
  })).request('/v1/walks', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ participantDogIds }),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(body.code, 'NOT_FOUND')
  assert.equal(body.message, 'The requested resource was not found.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})

test('POST /v1/walks returns 409 ACTIVE_WALK_EXISTS when a recording walk already exists', async () => {
  const response = await createStartWalkApp(async () => ({
    ok: false,
    error: 'active_walk_exists',
  })).request('/v1/walks', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ participantDogIds }),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 409)
  assert.equal(body.code, 'ACTIVE_WALK_EXISTS')
  assert.equal(body.message, 'すでに記録中の散歩があります。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})

test('POST /v1/walks returns 409 IDEMPOTENCY_CONFLICT when the same key has a different body', async () => {
  const response = await createStartWalkApp(async () => ({
    ok: false,
    error: 'idempotency_conflict',
  })).request('/v1/walks', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ participantDogIds }),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 409)
  assert.equal(body.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(body.message, '同じ要求を完了できません。最初からやり直してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})
