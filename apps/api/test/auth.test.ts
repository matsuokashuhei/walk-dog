import assert from 'node:assert/strict'
import test from 'node:test'
import { createCognitoClient } from '../src/auth/cognito.js'

test('creates a Cognito client with provided config', () => {
  const cognito = createCognitoClient({
    region: 'ap-northeast-1',
    userPoolId: 'pool-id',
    clientId: 'client-id',
  })

  assert.ok(cognito.client)
  assert.equal(typeof cognito.signUp, 'function')
  assert.equal(typeof cognito.confirmSignUp, 'function')
  assert.equal(typeof cognito.adminGetUser, 'function')
  assert.equal(typeof cognito.initiateAuth, 'function')
  assert.equal(typeof cognito.respondToAuthChallenge, 'function')
})
