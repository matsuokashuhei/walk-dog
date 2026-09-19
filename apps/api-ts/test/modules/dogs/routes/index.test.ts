import assert from 'node:assert/strict'
import test from 'node:test'
import { registerDogRoutes } from '../../../../src/modules/dogs/routes/index.js'
import {
  createDogApp,
  unusedCreateDog,
  unusedGetDog,
} from '../fixtures.js'

test('registerDogRoutes serves GET /v1/dogs on the mounted child app', async () => {
  const response = await createDogApp((routeApp) => {
    routeApp.route('/', registerDogRoutes({
      listDogs: async () => [],
      createDog: unusedCreateDog,
      getDog: unusedGetDog,
      accessTokenVerifier: {
        async verify() {
          return { cognitoSubject: 'sub-1' }
        },
      },
    }))
  }).request('/v1/dogs', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer access' },
  })
  const body = await response.json() as { dogs: unknown[] }
  assert.equal(response.status, 200)
  assert.deepEqual(body.dogs, [])
})
