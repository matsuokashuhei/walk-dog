import assert from 'node:assert/strict'
import test from 'node:test'
import { createCognitoClient } from '../../../src/infrastructure/cognito/client.js'

test('creates a Cognito client with provided config', () => {
  const cognito = createCognitoClient({
    region: 'ap-northeast-1',
    userPoolId: 'pool-id',
    clientId: 'client-id',
  }, {
    send: async () => {
      throw new Error('sender should not be called by construction assertions')
    },
  })

  assert.ok(cognito.client)
  assert.equal(typeof cognito.signUp, 'function')
  assert.equal(typeof cognito.confirmSignUp, 'function')
  assert.equal(typeof cognito.resendConfirmationCode, 'function')
  assert.equal(typeof cognito.adminGetUser, 'function')
  assert.equal(typeof cognito.initiateAuth, 'function')
  assert.equal(typeof cognito.respondToAuthChallenge, 'function')
})
