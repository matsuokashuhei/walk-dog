import assert from 'node:assert/strict'
import test from 'node:test'
import { registerWalkRoutes } from '../../../../src/modules/walks/routes/index.js'
import {
  createWalkApp,
  unusedFinishWalk,
  unusedStartWalk,
} from '../fixtures.js'

test('registerWalkRoutes serves GET /v1/walks/active on the mounted child app', async () => {
  const response = await createWalkApp((routeApp) => {
    routeApp.route('/', registerWalkRoutes({
      getActiveWalk: async () => null,
      startWalk: unusedStartWalk,
      finishWalk: unusedFinishWalk,
      accessTokenVerifier: {
        async verify() {
          return { cognitoSubject: 'sub-1' }
        },
      },
    }))
  }).request('/v1/walks/active', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer access' },
  })
  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
})
