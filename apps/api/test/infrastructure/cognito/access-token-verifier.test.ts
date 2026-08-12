import assert from 'node:assert/strict'
import test from 'node:test'
import { JwtParseError } from 'aws-jwt-verify/error'
import { createAccessTokenVerifier } from '../../../src/infrastructure/cognito/access-token-verifier.js'

const cognitoConfig = {
  region: 'ap-northeast-1',
  userPoolId: 'ap-northeast-1_Example',
  clientId: 'client-id',
}

test('createAccessTokenVerifier returns an AccessTokenVerifier', () => {
  const verifier = createAccessTokenVerifier(cognitoConfig)
  assert.equal(typeof verifier.verify, 'function')
})

test('verify rejects a malformed access token', async () => {
  const verifier = createAccessTokenVerifier(cognitoConfig)
  await assert.rejects(
    () => verifier.verify('not-a-jwt'),
    (error: unknown) => error instanceof JwtParseError,
  )
})

test('verify rejects an empty access token', async () => {
  const verifier = createAccessTokenVerifier(cognitoConfig)
  await assert.rejects(() => verifier.verify(''))
})
