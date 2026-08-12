import assert from 'node:assert/strict'
import test from 'node:test'
import { OpenAPIHono } from '@hono/zod-openapi'
import { registerAuthRoutes } from '../../../src/modules/auth/index.js'
import type {
  StartSignIn,
  StartSignUp,
  VerifySignIn,
  VerifySignUp,
} from '../../../src/modules/auth/types.js'
import type { AppVariables } from '../../../src/shared/http/types.js'

const unusedStartSignUp: StartSignUp = async () => {
  throw new Error('startSignUp should not run during auth aggregate OpenAPI checks')
}

const unusedStartSignIn: StartSignIn = async () => {
  throw new Error('startSignIn should not run during auth aggregate OpenAPI checks')
}

const unusedVerifySignUp: VerifySignUp = async () => {
  throw new Error('verifySignUp should not run during auth aggregate OpenAPI checks')
}

const unusedVerifySignIn: VerifySignIn = async () => {
  throw new Error('verifySignIn should not run during auth aggregate OpenAPI checks')
}

const expectedRelativePathMethods = {
  '/sign-up': ['post'],
  '/sign-up/verify': ['post'],
  '/sign-in': ['post'],
  '/sign-in/verify': ['post'],
} as const

const expectedPublicPathMethods = {
  '/v1/auth/sign-up': ['post'],
  '/v1/auth/sign-up/verify': ['post'],
  '/v1/auth/sign-in': ['post'],
  '/v1/auth/sign-in/verify': ['post'],
} as const

function pathMethodMap(paths: Record<string, Record<string, unknown>>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(paths).map(([path, pathItem]) => [path, Object.keys(pathItem)]),
  )
}

test('registerAuthRoutes exposes each auth endpoint once on relative paths', async () => {
  const authRoutes = registerAuthRoutes({
    startSignUp: unusedStartSignUp,
    verifySignUp: unusedVerifySignUp,
    startSignIn: unusedStartSignIn,
    verifySignIn: unusedVerifySignIn,
  })
  const response = await authRoutes.request('/openapi.json')
  assert.equal(response.status, 404)

  const parent = new OpenAPIHono<{ Variables: AppVariables }>()
  parent.route('/v1/auth', authRoutes)
  parent.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'auth aggregate', version: '0.0.0' },
  })
  const document = await (await parent.request('/openapi.json')).json() as {
    paths: Record<string, Record<string, unknown>>
  }

  assert.deepEqual(pathMethodMap(document.paths), expectedPublicPathMethods)
})

test('registerAuthRoutes child OpenAPI registry lists relative method-path pairs once', () => {
  const authRoutes = registerAuthRoutes({
    startSignUp: unusedStartSignUp,
    verifySignUp: unusedVerifySignUp,
    startSignIn: unusedStartSignIn,
    verifySignIn: unusedVerifySignIn,
  })
  const relativePathMethods: Record<string, string[]> = {}
  let routeCount = 0
  for (const definition of authRoutes.openAPIRegistry.definitions) {
    if (definition.type !== 'route') {
      continue
    }
    routeCount += 1
    relativePathMethods[definition.route.path] = [definition.route.method]
  }

  assert.deepEqual(relativePathMethods, expectedRelativePathMethods)
  assert.equal(routeCount, 4)
})
