import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GlobalSignOutCommand,
  LimitExceededException,
  NotAuthorizedException,
  TooManyRequestsException,
} from '@aws-sdk/client-cognito-identity-provider'
import type { CognitoClient } from '../../../src/infrastructure/cognito/client.js'
import { createCognitoAuthProvider } from '../../../src/infrastructure/cognito/cognito-auth-provider.js'
import { createRecordingProvider } from './recording-provider.js'

test('signOut returns signed-out when Cognito GlobalSignOut succeeds', async () => {
  const client = {
    globalSignOut: async (accessToken: string) => {
      assert.equal(accessToken, 'access')
    },
  }
  const provider = createCognitoAuthProvider(client as CognitoClient)
  assert.deepEqual(await provider.signOut('access'), { outcome: 'signed-out' })
})

test('signOut sends GlobalSignOutCommand with AccessToken', async () => {
  const { provider, commands } = createRecordingProvider(async () => ({}))
  assert.deepEqual(await provider.signOut('access-token'), { outcome: 'signed-out' })
  assert.equal(commands.length, 1)
  assert.ok(commands[0] instanceof GlobalSignOutCommand)
  assert.deepEqual(commands[0].input, { AccessToken: 'access-token' })
})

test('signOut converts NotAuthorizedException to authentication-failed', async () => {
  const { provider } = createRecordingProvider(async () => {
    throw new NotAuthorizedException({ message: 'not authorized' })
  })
  assert.deepEqual(await provider.signOut('access'), { outcome: 'authentication-failed' })
})

test('signOut converts TooManyRequestsException to rate-limited', async () => {
  const { provider } = createRecordingProvider(async () => {
    throw new TooManyRequestsException({ message: 'slow down' })
  })
  assert.deepEqual(await provider.signOut('access'), { outcome: 'rate-limited' })
})

test('signOut converts LimitExceededException to rate-limited', async () => {
  const { provider } = createRecordingProvider(async () => {
    throw new LimitExceededException({ message: 'limit' })
  })
  assert.deepEqual(await provider.signOut('access'), { outcome: 'rate-limited' })
})

test('signOut propagates unexpected errors by identity', async () => {
  const unexpected = new Error('sign-out gateway boom')
  const { provider } = createRecordingProvider(async () => {
    throw unexpected
  })
  await assert.rejects(
    () => provider.signOut('access'),
    (error: unknown) => error === unexpected,
  )
})
