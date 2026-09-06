import assert from 'node:assert/strict'
import { createApp } from '../../src/app.js'
import { setRequestIdTag } from '../../src/infrastructure/observability/sentry.js'
import { registerAuthRoutes } from '../../src/modules/auth/index.js'
import { registerDogRoutes, type ListDogs } from '../../src/modules/dogs/index.js'
import { registerOwnerRoutes } from '../../src/modules/owners/index.js'
import { registerWalkRoutes } from '../../src/modules/walks/index.js'
import { unusedAuthRouteDependencies } from '../modules/auth/fixtures.js'
import {
  unusedCreateDog,
  unusedGetDog,
} from '../modules/dogs/fixtures.js'
import {
  unusedAccessTokenVerifier,
  unusedGetOwner,
  unusedUpdateOwnerDisplayName,
} from '../modules/owners/fixtures.js'
import {
  unusedAcceptTrackPoint,
  unusedDeleteWalk,
  unusedFinishWalk,
  unusedGetActiveWalk,
  unusedGetWalkDetail,
  unusedRecordEvent,
  unusedStartWalk,
} from '../modules/walks/fixtures.js'
import { registerHealthyHealthRoutes } from './health-routes.js'
import { testLogger } from './test-logger.js'

export type PropertySchema = {
  nullable?: boolean
  type?: string
  format?: string
  minLength?: number
  maxLength?: number
  minItems?: number
}

export type JsonSchema = {
  required?: string[]
  properties: Record<string, PropertySchema>
  additionalProperties?: boolean
}

export type OpenApiOperation = {
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

export type OpenApiDocument = {
  openapi: string
  paths: Record<string, Record<string, OpenApiOperation>>
  components: {
    schemas: Record<string, unknown>
    securitySchemes?: Record<string, unknown>
  }
}

export const expectedOperations = {
  '/health': { get: ['200', '500', '503'] },
  '/v1/auth/sign-up': { post: ['200', '400', '409', '429', '500'] },
  '/v1/auth/sign-up/verify': { post: ['200', '400', '409', '429', '500'] },
  '/v1/auth/sign-in': { post: ['200', '400', '409', '429', '500'] },
  '/v1/auth/sign-in/verify': { post: ['200', '400', '409', '429', '500'] },
  '/v1/auth/sign-out': { post: ['204', '400', '401', '429', '500'] },
  '/v1/owner': { get: ['200', '401', '500'], patch: ['200', '400', '401', '500'] },
  '/v1/dogs': { get: ['200', '401', '500'], post: ['201', '400', '401', '409', '500'] },
  '/v1/dogs/{dogId}': { get: ['200', '401', '404', '500'] },
  '/v1/walks/active': { get: ['200', '204', '401', '500'] },
  '/v1/walks': { post: ['201', '400', '401', '404', '409', '500'] },
  '/v1/walks/{walkId}': { get: ['200', '401', '404', '500'], delete: ['204', '401', '404', '409', '500'] },
  '/v1/walks/{walkId}/finish': { post: ['200', '400', '401', '404', '409', '500', '503'] },
  '/v1/walks/{walkId}/track-points': { post: ['201', '400', '401', '404', '409', '500'] },
  '/v1/walks/{walkId}/events': { post: ['200', '201', '400', '401', '404', '409', '500'] },
} as const

export const expectedPathMethods = {
  '/health': ['get'],
  '/v1/auth/sign-up': ['post'],
  '/v1/auth/sign-up/verify': ['post'],
  '/v1/auth/sign-in': ['post'],
  '/v1/auth/sign-in/verify': ['post'],
  '/v1/auth/sign-out': ['post'],
  '/v1/owner': ['get', 'patch'],
  '/v1/dogs': ['get', 'post'],
  '/v1/dogs/{dogId}': ['get'],
  '/v1/walks/active': ['get'],
  '/v1/walks': ['post'],
  '/v1/walks/{walkId}': ['get', 'delete'],
  '/v1/walks/{walkId}/finish': ['post'],
  '/v1/walks/{walkId}/track-points': ['post'],
  '/v1/walks/{walkId}/events': ['post'],
} as const

export const publicAuthPaths = [
  '/v1/auth/sign-up',
  '/v1/auth/sign-up/verify',
  '/v1/auth/sign-in',
  '/v1/auth/sign-in/verify',
] as const

const unusedListDogs: ListDogs = async () => {
  throw new Error('listDogs should not run during OpenAPI document generation')
}

export function createOpenApiApp() {
  return createApp(
    { logger: testLogger, setRequestId: setRequestIdTag },
    [
      { path: '/', app: registerHealthyHealthRoutes() },
      { path: '/v1/auth', app: registerAuthRoutes(unusedAuthRouteDependencies) },
      {
        path: '/v1/owner',
        app: registerOwnerRoutes({
          getOwner: unusedGetOwner,
          updateOwnerDisplayName: unusedUpdateOwnerDisplayName,
          accessTokenVerifier: unusedAccessTokenVerifier,
        }),
      },
      {
        path: '/v1/dogs',
        app: registerDogRoutes({
          listDogs: unusedListDogs,
          createDog: unusedCreateDog,
          getDog: unusedGetDog,
          accessTokenVerifier: unusedAccessTokenVerifier,
        }),
      },
      {
        path: '/v1/walks',
        app: registerWalkRoutes({
          getActiveWalk: unusedGetActiveWalk,
          getWalkDetail: unusedGetWalkDetail,
          startWalk: unusedStartWalk,
          finishWalk: unusedFinishWalk,
          deleteWalk: unusedDeleteWalk,
          acceptTrackPoint: unusedAcceptTrackPoint,
          recordEvent: unusedRecordEvent,
          accessTokenVerifier: unusedAccessTokenVerifier,
        }),
      },
    ],
  )
}

export function operationAt(document: OpenApiDocument, path: string, method: string): OpenApiOperation {
  const pathItem = document.paths[path]
  assert.ok(pathItem, `missing path ${path}`)
  const operation = pathItem[method]
  assert.ok(operation, `missing ${method.toUpperCase()} ${path}`)
  return operation
}

export function assertOperationStatuses(
  document: OpenApiDocument,
  path: string,
  method: string,
  statuses: readonly string[],
): void {
  assert.deepEqual(Object.keys(operationAt(document, path, method).responses), [...statuses])
}

export function pathMethodMap(document: OpenApiDocument): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(document.paths).map(([path, pathItem]) => [path, Object.keys(pathItem)]),
  )
}

export function requestSchema(document: OpenApiDocument, path: string, method = 'post'): JsonSchema {
  const requestBody = operationAt(document, path, method).requestBody
  assert.ok(requestBody, `missing request body for ${method.toUpperCase()} ${path}`)
  return requestBody.content['application/json'].schema
}

export function assertEmailRequestSchema(schema: JsonSchema): void {
  assert.deepEqual(schema.required, ['email'])
  assert.equal(schema.properties.email.format, 'email')
  assert.equal(schema.properties.email.nullable, undefined)
}

export function assertOwnerPatchRequestSchema(schema: JsonSchema): void {
  assert.deepEqual(schema.required, ['displayName'])
  assert.equal(schema.properties.displayName.minLength, 1)
  assert.equal(schema.properties.displayName.maxLength, 100)
  assert.equal(schema.properties.displayName.nullable, undefined)
}

export function assertCreateDogRequestSchema(schema: JsonSchema): void {
  assert.deepEqual(schema.required, ['name', 'gender'])
  assert.equal(schema.properties.name.minLength, 1)
  assert.equal(schema.properties.name.maxLength, 100)
  assert.equal(schema.properties.name.nullable, undefined)
}

export function assertStartWalkRequestSchema(schema: JsonSchema): void {
  assert.deepEqual(schema.required, ['participantDogIds'])
  assert.equal(schema.properties.participantDogIds.minItems, 1)
}

export function assertFinishWalkRequestSchema(schema: JsonSchema): void {
  assert.equal(schema.additionalProperties, false)
}

export function assertAcceptTrackPointRequestSchema(schema: JsonSchema): void {
  assert.deepEqual(schema.required, ['recordedAt', 'latitude', 'longitude'])
  assert.equal(schema.additionalProperties, false)
  assert.equal(schema.properties.recordedAt.format, 'date-time')
  assert.equal(schema.properties.recordedAt.nullable, undefined)
  assert.equal(schema.properties.latitude.nullable, undefined)
  assert.equal(schema.properties.longitude.nullable, undefined)
}

export function assertRecordEventRequestSchema(schema: JsonSchema): void {
  assert.deepEqual(schema.required, [
    'eventId',
    'participantDogId',
    'type',
    'occurredAt',
    'latitude',
    'longitude',
  ])
  assert.equal(schema.additionalProperties, false)
  assert.equal(schema.properties.eventId.format, 'uuid')
  assert.equal(schema.properties.eventId.nullable, undefined)
  assert.equal(schema.properties.participantDogId.format, 'uuid')
  assert.equal(schema.properties.participantDogId.nullable, undefined)
  assert.equal(schema.properties.type.nullable, undefined)
  assert.equal(schema.properties.occurredAt.format, 'date-time')
  assert.equal(schema.properties.occurredAt.nullable, undefined)
  assert.equal(schema.properties.latitude.nullable, undefined)
  assert.equal(schema.properties.longitude.nullable, undefined)
}

export function assertVerifyRequestSchema(schema: JsonSchema, sessionNullable: boolean | undefined): void {
  assert.deepEqual(schema.required, ['username', 'session', 'code'])
  assert.equal(schema.properties.username.minLength, 1)
  assert.equal(schema.properties.username.nullable, undefined)
  assert.equal(schema.properties.session.nullable, sessionNullable)
  assert.equal(schema.properties.session.minLength, 1)
  assert.equal(schema.properties.code.minLength, 1)
  assert.equal(schema.properties.code.nullable, undefined)
}
