import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AliasExistsException,
  CodeMismatchException,
  ConfirmSignUpCommand,
  ExpiredCodeException,
  InitiateAuthCommand,
  LimitExceededException,
  NotAuthorizedException,
  RespondToAuthChallengeCommand,
  TooManyRequestsException,
} from '@aws-sdk/client-cognito-identity-provider'
import { makeIdToken } from '../../modules/auth/fixtures.js'
import { createRecordingProvider } from './recording-provider.js'

test('verifySignUp sends ConfirmSignUp then InitiateAuth and returns Authentication', async () => {
  const idToken = makeIdToken('test-cognito-sub')
  const { provider, commands } = createRecordingProvider(async (command) => {
    if (command instanceof ConfirmSignUpCommand) {
      return { Session: 'confirmed-session' }
    }
    if (command instanceof InitiateAuthCommand) {
      return {
        AuthenticationResult: {
          AccessToken: 'mock-access-token',
          IdToken: idToken,
          RefreshToken: 'mock-refresh-token',
        },
      }
    }
    const name = command instanceof Object && 'constructor' in command
      ? (command.constructor as { name?: string }).name
      : 'unknown'
    throw new Error(`unexpected command ${name ?? 'unknown'}`)
  })
  const result = await provider.verifySignUp({
    username: 'test@example.com',
    session: 'test-session',
    code: '123456',
  })
  assert.equal(commands.length, 2)
  assert.ok(commands[0] instanceof ConfirmSignUpCommand)
  assert.deepEqual(commands[0].input, {
    ClientId: 'client-id',
    Username: 'test@example.com',
    ConfirmationCode: '123456',
    Session: 'test-session',
  })
  assert.ok(commands[1] instanceof InitiateAuthCommand)
  assert.deepEqual(commands[1].input, {
    ClientId: 'client-id',
    AuthFlow: 'USER_AUTH',
    AuthParameters: { USERNAME: 'test@example.com', PREFERRED_CHALLENGE: 'EMAIL_OTP' },
    Session: 'confirmed-session',
  })
  assert.deepEqual(result, {
    outcome: 'authenticated',
    authentication: {
      subject: 'test-cognito-sub',
      accessToken: 'mock-access-token',
      idToken,
      refreshToken: 'mock-refresh-token',
    },
  })
})

test('verifySignUp falls back to request session for InitiateAuth', async () => {
  const idToken = makeIdToken('test-cognito-sub')
  const { provider, commands } = createRecordingProvider(async (command) => {
    if (command instanceof ConfirmSignUpCommand) {
      return {}
    }
    if (command instanceof InitiateAuthCommand) {
      return {
        AuthenticationResult: {
          AccessToken: 'a',
          IdToken: idToken,
          RefreshToken: 'r',
        },
      }
    }
    throw new Error('unexpected')
  })
  await provider.verifySignUp({
    username: 'test@example.com',
    session: 'request-session',
    code: '123456',
  })
  assert.ok(commands[0] instanceof ConfirmSignUpCommand)
  assert.equal(commands[0].input.Session, 'request-session')
  assert.ok(commands[1] instanceof InitiateAuthCommand)
  assert.equal(commands[1].input.Session, 'request-session')
})

test('verifySignUp passes undefined Session when request session is null', async () => {
  const idToken = makeIdToken('test-cognito-sub')
  const { provider, commands } = createRecordingProvider(async (command) => {
    if (command instanceof ConfirmSignUpCommand) {
      return { Session: 'from-confirm' }
    }
    if (command instanceof InitiateAuthCommand) {
      return {
        AuthenticationResult: {
          AccessToken: 'a',
          IdToken: idToken,
          RefreshToken: 'r',
        },
      }
    }
    throw new Error('unexpected')
  })
  await provider.verifySignUp({
    username: 'test@example.com',
    session: null,
    code: '123456',
  })
  assert.ok(commands[0] instanceof ConfirmSignUpCommand)
  assert.equal(commands[0].input.Session, undefined)
  assert.ok(commands[1] instanceof InitiateAuthCommand)
  assert.equal(commands[1].input.Session, 'from-confirm')
})

test('verifySignUp returns incomplete-authentication without complete tokens', async () => {
  const { provider } = createRecordingProvider(async (command) => {
    if (command instanceof ConfirmSignUpCommand) {
      return { Session: 'confirmed-session' }
    }
    return { AuthenticationResult: { AccessToken: 'a', IdToken: makeIdToken('sub') } }
  })
  assert.deepEqual(
    await provider.verifySignUp({
      username: 'test@example.com',
      session: 'test-session',
      code: '123456',
    }),
    { outcome: 'incomplete-authentication' },
  )
})

test('verifySignUp returns incomplete-authentication when ID token sub is not a string', async () => {
  const payload = Buffer.from(JSON.stringify({ sub: 123 })).toString('base64')
  const { provider } = createRecordingProvider(async (command) => {
    if (command instanceof ConfirmSignUpCommand) {
      return { Session: 'confirmed-session' }
    }
    return {
      AuthenticationResult: {
        AccessToken: 'a',
        IdToken: `header.${payload}.signature`,
        RefreshToken: 'r',
      },
    }
  })
  assert.deepEqual(
    await provider.verifySignUp({
      username: 'test@example.com',
      session: 'test-session',
      code: '123456',
    }),
    { outcome: 'incomplete-authentication' },
  )
})

test('verifySignUp converts documented Cognito exceptions', async () => {
  const cases = [
    [new ExpiredCodeException({ message: 'expired' }), 'code-expired'],
    [new CodeMismatchException({ message: 'mismatch' }), 'invalid-code'],
    [new AliasExistsException({ message: 'alias' }), 'code-already-used'],
    [new NotAuthorizedException({ message: 'denied' }), 'already-confirmed'],
    [new TooManyRequestsException({ message: 'slow' }), 'rate-limited'],
    [new LimitExceededException({ message: 'limit' }), 'rate-limited'],
  ] as const
  for (const [exception, outcome] of cases) {
    const { provider } = createRecordingProvider(async () => {
      throw exception
    })
    assert.deepEqual(
      await provider.verifySignUp({
        username: 'test@example.com',
        session: 'test-session',
        code: '000000',
      }),
      { outcome },
    )
  }
})

test('verifySignUp propagates unexpected errors by identity', async () => {
  const unexpected = new Error('verify sign-up gateway boom')
  const { provider } = createRecordingProvider(async () => {
    throw unexpected
  })
  await assert.rejects(
    () => provider.verifySignUp({
      username: 'test@example.com',
      session: 'test-session',
      code: '123456',
    }),
    (error: unknown) => error === unexpected,
  )
})

test('verifySignIn sends RespondToAuthChallenge and returns Authentication', async () => {
  const idToken = makeIdToken('test-cognito-sub')
  const { provider, commands } = createRecordingProvider(async () => ({
    AuthenticationResult: {
      AccessToken: 'mock-access',
      IdToken: idToken,
      RefreshToken: 'mock-refresh',
    },
  }))
  const result = await provider.verifySignIn({
    username: 'test@example.com',
    session: 'sign-in-session',
    code: '12345678',
  })
  assert.equal(commands.length, 1)
  assert.ok(commands[0] instanceof RespondToAuthChallengeCommand)
  assert.deepEqual(commands[0].input, {
    ClientId: 'client-id',
    ChallengeName: 'EMAIL_OTP',
    ChallengeResponses: { USERNAME: 'test@example.com', EMAIL_OTP_CODE: '12345678' },
    Session: 'sign-in-session',
  })
  assert.deepEqual(result, {
    outcome: 'authenticated',
    authentication: {
      subject: 'test-cognito-sub',
      accessToken: 'mock-access',
      idToken,
      refreshToken: 'mock-refresh',
    },
  })
})

test('verifySignIn returns incomplete-authentication without complete tokens', async () => {
  const { provider } = createRecordingProvider(async () => ({
    AuthenticationResult: { AccessToken: 'a', RefreshToken: 'r' },
  }))
  assert.deepEqual(
    await provider.verifySignIn({
      username: 'test@example.com',
      session: 'sign-in-session',
      code: '12345678',
    }),
    { outcome: 'incomplete-authentication' },
  )
})

test('verifySignIn converts documented Cognito exceptions', async () => {
  const cases = [
    [new ExpiredCodeException({ message: 'expired' }), 'code-expired'],
    [new CodeMismatchException({ message: 'mismatch' }), 'invalid-code'],
    [new AliasExistsException({ message: 'alias' }), 'code-already-used'],
    [new NotAuthorizedException({ message: 'denied' }), 'authentication-failed'],
    [new TooManyRequestsException({ message: 'slow' }), 'rate-limited'],
    [new LimitExceededException({ message: 'limit' }), 'rate-limited'],
  ] as const
  for (const [exception, outcome] of cases) {
    const { provider } = createRecordingProvider(async () => {
      throw exception
    })
    assert.deepEqual(
      await provider.verifySignIn({
        username: 'test@example.com',
        session: 'sign-in-session',
        code: '00000000',
      }),
      { outcome },
    )
  }
})

test('verifySignIn propagates unexpected errors by identity', async () => {
  const unexpected = new Error('verify sign-in gateway boom')
  const { provider } = createRecordingProvider(async () => {
    throw unexpected
  })
  await assert.rejects(
    () => provider.verifySignIn({
      username: 'test@example.com',
      session: 'sign-in-session',
      code: '12345678',
    }),
    (error: unknown) => error === unexpected,
  )
})
