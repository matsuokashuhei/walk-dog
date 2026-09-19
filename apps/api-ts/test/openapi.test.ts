import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertAcceptTrackPointRequestSchema,
  assertCreateDogRequestSchema,
  assertEmailRequestSchema,
  assertFinishWalkRequestSchema,
  assertOperationStatuses,
  assertOwnerPatchRequestSchema,
  assertRecordEventRequestSchema,
  assertStartWalkRequestSchema,
  assertVerifyRequestSchema,
  createOpenApiApp,
  expectedOperations,
  expectedPathMethods,
  operationAt,
  pathMethodMap,
  publicAuthPaths,
  requestSchema,
  type OpenApiDocument,
} from './support/openapi-document.js'

test('GET /openapi.json characterizes health, auth, owner, dog, and walk operations', async () => {
  const response = await createOpenApiApp().request('/openapi.json')
  const document = await response.json() as OpenApiDocument

  assert.equal(response.status, 200)
  assert.equal(document.openapi, '3.1.0')
  assert.ok('Error' in document.components.schemas)
  assert.deepEqual(document.components.securitySchemes?.BearerAuth, {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  })
  assert.deepEqual(pathMethodMap(document), expectedPathMethods)

  assertOperationStatuses(document, '/health', 'get', expectedOperations['/health'].get)
  assertOperationStatuses(document, '/v1/auth/sign-up', 'post', expectedOperations['/v1/auth/sign-up'].post)
  assertOperationStatuses(document, '/v1/auth/sign-up/verify', 'post', expectedOperations['/v1/auth/sign-up/verify'].post)
  assertOperationStatuses(document, '/v1/auth/sign-in', 'post', expectedOperations['/v1/auth/sign-in'].post)
  assertOperationStatuses(document, '/v1/auth/sign-in/verify', 'post', expectedOperations['/v1/auth/sign-in/verify'].post)
  assertOperationStatuses(document, '/v1/auth/sign-out', 'post', expectedOperations['/v1/auth/sign-out'].post)
  assertOperationStatuses(document, '/v1/owner', 'get', expectedOperations['/v1/owner'].get)
  assertOperationStatuses(document, '/v1/owner', 'patch', expectedOperations['/v1/owner'].patch)
  assertOperationStatuses(document, '/v1/dogs', 'get', expectedOperations['/v1/dogs'].get)
  assertOperationStatuses(document, '/v1/dogs', 'post', expectedOperations['/v1/dogs'].post)
  assertOperationStatuses(document, '/v1/dogs/{dogId}', 'get', expectedOperations['/v1/dogs/{dogId}'].get)
  assertOperationStatuses(document, '/v1/walks/active', 'get', expectedOperations['/v1/walks/active'].get)
  assertOperationStatuses(document, '/v1/walks', 'post', expectedOperations['/v1/walks'].post)
  assertOperationStatuses(document, '/v1/walks/{walkId}', 'get', expectedOperations['/v1/walks/{walkId}'].get)
  assertOperationStatuses(document, '/v1/walks/{walkId}', 'delete', expectedOperations['/v1/walks/{walkId}'].delete)
  assertOperationStatuses(document, '/v1/walks/{walkId}/finish', 'post', expectedOperations['/v1/walks/{walkId}/finish'].post)
  assertOperationStatuses(document, '/v1/walks/{walkId}/track-points', 'post', expectedOperations['/v1/walks/{walkId}/track-points'].post)
  assertOperationStatuses(document, '/v1/walks/{walkId}/events', 'post', expectedOperations['/v1/walks/{walkId}/events'].post)

  assert.deepEqual(operationAt(document, '/v1/auth/sign-out', 'post').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/owner', 'get').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/owner', 'patch').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/dogs', 'get').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/dogs', 'post').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/dogs/{dogId}', 'get').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/walks/active', 'get').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/walks', 'post').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/walks/{walkId}', 'get').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/walks/{walkId}', 'delete').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/walks/{walkId}/finish', 'post').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/walks/{walkId}/track-points', 'post').security, [{ BearerAuth: [] }])
  assert.deepEqual(operationAt(document, '/v1/walks/{walkId}/events', 'post').security, [{ BearerAuth: [] }])
  for (const path of publicAuthPaths) {
    assert.equal(operationAt(document, path, 'post').security, undefined)
  }

  assertEmailRequestSchema(requestSchema(document, '/v1/auth/sign-up'))
  assertEmailRequestSchema(requestSchema(document, '/v1/auth/sign-in'))
  assertVerifyRequestSchema(requestSchema(document, '/v1/auth/sign-up/verify'), true)
  assertVerifyRequestSchema(requestSchema(document, '/v1/auth/sign-in/verify'), undefined)
  assertOwnerPatchRequestSchema(requestSchema(document, '/v1/owner', 'patch'))
  assertCreateDogRequestSchema(requestSchema(document, '/v1/dogs'))
  assertStartWalkRequestSchema(requestSchema(document, '/v1/walks'))
  assertFinishWalkRequestSchema(requestSchema(document, '/v1/walks/{walkId}/finish'))
  assertAcceptTrackPointRequestSchema(requestSchema(document, '/v1/walks/{walkId}/track-points'))
  assertRecordEventRequestSchema(requestSchema(document, '/v1/walks/{walkId}/events'))
})
