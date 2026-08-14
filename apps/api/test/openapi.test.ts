import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { setRequestIdTag } from '../src/infrastructure/observability/sentry.js'
import { registerAuthRoutes } from '../src/modules/auth/index.js'
import { registerHealthRoutes } from '../src/modules/health/index.js'
import { registerOwnerRoutes } from '../src/modules/owners/index.js'
import { unusedAuthRouteDependencies } from './modules/auth/fixtures.js'
import {
  unusedAccessTokenVerifier,
  unusedGetOwner,
  unusedUpdateOwnerDisplayName,
} from './modules/owners/fixtures.js'
import { testLogger } from './support/test-logger.js'

type PropertySchema = {
  nullable?: boolean
  type?: string
  format?: string
  minLength?: number
}

type JsonSchema = {
  required: string[]
  properties: Record<string, PropertySchema>
}

type OpenApiOperation = {
  responses: Record<string, unknown>
  security?: Array<Record<string, string[]>>
  requestBody?: {
    content: {
      'application/json': {
        schema: JsonSchema
      }
    }
  }
}

type OpenApiDocument = {
  openapi: string
  paths: Record<string, Record<string, OpenApiOperation>>
  components: {
    schemas: Record<string, unknown>
    securitySchemes?: Record<string, unknown>
  }
}

const expectedOperations = {
  '/health': { get: ['200', '500'] },
  '/v1/auth/sign-up': { post: ['200', '400', '409', '429', '500'] },
  '/v1/auth/sign-up/verify': { post: ['200', '400', '409', '429', '500'] },
  '/v1/auth/sign-in': { post: ['200', '400', '409', '429', '500'] },
  '/v1/auth/sign-in/verify': { post: ['200', '400', '409', '429', '500'] },
  '/v1/auth/sign-out': { post: ['204', '400', '401', '429', '500'] },
  '/v1/owner': { get: ['200', '401', '500'], patch: ['200', '400', '401', '500'] },
} as const

/** Exact path → methods present in the generated document (`app.doc` is served, not listed). */
const expectedPathMethods = {
  '/health': ['get'],
  '/v1/auth/sign-up': ['post'],
  '/v1/auth/sign-up/verify': ['post'],
  '/v1/auth/sign-in': ['post'],
  '/v1/auth/sign-in/verify': ['post'],
  '/v1/auth/sign-out': ['post'],
  '/v1/owner': ['get', 'patch'],
} as const

const publicAuthPaths = [
  '/v1/auth/sign-up',
  '/v1/auth/sign-up/verify',
  '/v1/auth/sign-in',
  '/v1/auth/sign-in/verify',
] as const

function createOpenApiApp() {
  return createApp(
    { logger: testLogger, setRequestId: setRequestIdTag },
    [
      { path: '/', app: registerHealthRoutes() },
      { path: '/v1/auth', app: registerAuthRoutes(unusedAuthRouteDependencies) },
      {
        path: '/v1/owner',
        app: registerOwnerRoutes({
          getOwner: unusedGetOwner,
          updateOwnerDisplayName: unusedUpdateOwnerDisplayName,
          accessTokenVerifier: unusedAccessTokenVerifier,
        }),
      },
    ],
  )
}

function operationAt(document: OpenApiDocument, path: string, method: string): OpenApiOperation {
  const pathItem = document.paths[path]
  assert.ok(pathItem, `missing path ${path}`)
  const operation = pathItem[method]
  assert.ok(operation, `missing ${method.toUpperCase()} ${path}`)
  return operation
}

function assertOperationStatuses(
  document: OpenApiDocument,
  path: string,
  method: string,
  statuses: readonly string[],
): void {
  assert.deepEqual(Object.keys(operationAt(document, path, method).responses), [...statuses])
}

function pathMethodMap(document: OpenApiDocument): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(document.paths).map(([path, pathItem]) => [path, Object.keys(pathItem)]),
  )
}

function requestSchema(document: OpenApiDocument, path: string): JsonSchema {
  const requestBody = operationAt(document, path, 'post').requestBody
  assert.ok(requestBody, `missing request body for ${path}`)
  return requestBody.content['application/json'].schema
}

function assertEmailRequestSchema(schema: JsonSchema): void {
  assert.deepEqual(schema.required, ['email'])
  assert.equal(schema.properties.email.format, 'email')
  assert.equal(schema.properties.email.nullable, undefined)
}

function assertVerifyRequestSchema(schema: JsonSchema, sessionNullable: boolean | undefined): void {
  assert.deepEqual(schema.required, ['username', 'session', 'code'])
  assert.equal(schema.properties.username.minLength, 1)
  assert.equal(schema.properties.username.nullable, undefined)
  assert.equal(schema.properties.session.nullable, sessionNullable)
  assert.equal(schema.properties.session.minLength, 1)
  assert.equal(schema.properties.code.minLength, 1)
  assert.equal(schema.properties.code.nullable, undefined)
}

test('GET /openapi.json characterizes health and auth operations', async () => {
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

  assert.deepEqual(
    operationAt(document, '/v1/auth/sign-out', 'post').security,
    [{ BearerAuth: [] }],
  )
  assert.deepEqual(
    operationAt(document, '/v1/owner', 'get').security,
    [{ BearerAuth: [] }],
  )
  assert.deepEqual(
    operationAt(document, '/v1/owner', 'patch').security,
    [{ BearerAuth: [] }],
  )
  for (const path of publicAuthPaths) {
    assert.equal(operationAt(document, path, 'post').security, undefined)
  }

  assertEmailRequestSchema(requestSchema(document, '/v1/auth/sign-up'))
  assertEmailRequestSchema(requestSchema(document, '/v1/auth/sign-in'))
  assertVerifyRequestSchema(requestSchema(document, '/v1/auth/sign-up/verify'), true)
  assertVerifyRequestSchema(requestSchema(document, '/v1/auth/sign-in/verify'), undefined)
})
