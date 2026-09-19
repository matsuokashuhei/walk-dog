import assert from 'node:assert/strict'
import test from 'node:test'
import {
  InitiateAuthCommand,
  InvalidParameterException,
  LimitExceededException,
  NotAuthorizedException,
  ResendConfirmationCodeCommand,
  SignUpCommand,
  TooManyRequestsException,
  UsernameExistsException,
  UserNotConfirmedException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider'
import { createRecordingProvider } from './recording-provider.js'

test('signUp sends SignUpCommand and converts PascalCase output', async () => {
  const { provider, commands } = createRecordingProvider(async () => ({
    Session: 'test-session',
    CodeDeliveryDetails: { Destination: 't***@t***', AttributeName: 'email' },
  }))
  const result = await provider.signUp('test@example.com')
  assert.equal(commands.length, 1)
  assert.ok(commands[0] instanceof SignUpCommand)
  assert.deepEqual(commands[0].input, {
    ClientId: 'client-id',
    Username: 'test@example.com',
    UserAttributes: [{ Name: 'email', Value: 'test@example.com' }],
  })
  assert.deepEqual(result, {
    outcome: 'signed-up',
    session: 'test-session',
    codeDelivery: { destination: 't***@t***', attribute: 'email' },
  })
})

test('signUp converts UsernameExistsException to username-exists', async () => {
  const { provider } = createRecordingProvider(async () => {
    throw new UsernameExistsException({ message: 'exists' })
  })
  assert.deepEqual(await provider.signUp('test@example.com'), { outcome: 'username-exists' })
})

test('signUp converts InvalidParameterException to invalid-input', async () => {
  const { provider } = createRecordingProvider(async () => {
    throw new InvalidParameterException({ message: 'invalid' })
  })
  assert.deepEqual(await provider.signUp('test@example.com'), { outcome: 'invalid-input' })
})

test('signUp converts TooManyRequestsException to rate-limited', async () => {
  const { provider } = createRecordingProvider(async () => {
    throw new TooManyRequestsException({ message: 'slow down' })
  })
  assert.deepEqual(await provider.signUp('test@example.com'), { outcome: 'rate-limited' })
})

test('signUp converts LimitExceededException to rate-limited', async () => {
  const { provider } = createRecordingProvider(async () => {
    throw new LimitExceededException({ message: 'limit' })
  })
  assert.deepEqual(await provider.signUp('test@example.com'), { outcome: 'rate-limited' })
})

test('signUp propagates unexpected errors by identity', async () => {
  const unexpected = new Error('sign-up gateway boom')
  const { provider } = createRecordingProvider(async () => {
    throw unexpected
  })
  await assert.rejects(
    () => provider.signUp('test@example.com'),
    (error: unknown) => error === unexpected,
  )
})

test('resendSignUpCode sends ResendConfirmationCodeCommand and converts output', async () => {
  const { provider, commands } = createRecordingProvider(async () => ({
    CodeDeliveryDetails: { Destination: 'r***@e***', AttributeName: 'email' },
  }))
  const result = await provider.resendSignUpCode('test@example.com')
  assert.equal(commands.length, 1)
  assert.ok(commands[0] instanceof ResendConfirmationCodeCommand)
  assert.deepEqual(commands[0].input, {
    ClientId: 'client-id',
    Username: 'test@example.com',
  })
  assert.deepEqual(result, {
    outcome: 'code-sent',
    codeDelivery: { destination: 'r***@e***', attribute: 'email' },
  })
})

test('resendSignUpCode converts InvalidParameterException to already-confirmed', async () => {
  const { provider } = createRecordingProvider(async () => {
    throw new InvalidParameterException({ message: 'confirmed' })
  })
  assert.deepEqual(await provider.resendSignUpCode('test@example.com'), { outcome: 'already-confirmed' })
})

test('resendSignUpCode converts rate-limit exceptions', async () => {
  const { provider: tooMany } = createRecordingProvider(async () => {
    throw new TooManyRequestsException({ message: 'slow down' })
  })
  assert.deepEqual(await tooMany.resendSignUpCode('test@example.com'), { outcome: 'rate-limited' })

  const { provider: limited } = createRecordingProvider(async () => {
    throw new LimitExceededException({ message: 'limit' })
  })
  assert.deepEqual(await limited.resendSignUpCode('test@example.com'), { outcome: 'rate-limited' })
})

test('resendSignUpCode propagates unexpected errors by identity', async () => {
  const unexpected = new Error('resend gateway boom')
  const { provider } = createRecordingProvider(async () => {
    throw unexpected
  })
  await assert.rejects(
    () => provider.resendSignUpCode('test@example.com'),
    (error: unknown) => error === unexpected,
  )
})

test('startSignIn sends InitiateAuthCommand with USER_AUTH EMAIL_OTP and converts challenge', async () => {
  const { provider, commands } = createRecordingProvider(async () => ({
    ChallengeName: 'EMAIL_OTP',
    Session: 'sign-in-session',
    ChallengeParameters: { CODE_DELIVERY_DESTINATION: 't***@t***' },
  }))
  const result = await provider.startSignIn('test@example.com')
  assert.equal(commands.length, 1)
  assert.ok(commands[0] instanceof InitiateAuthCommand)
  assert.deepEqual(commands[0].input, {
    ClientId: 'client-id',
    AuthFlow: 'USER_AUTH',
    AuthParameters: { USERNAME: 'test@example.com', PREFERRED_CHALLENGE: 'EMAIL_OTP' },
    Session: undefined,
  })
  assert.deepEqual(result, {
    outcome: 'challenge',
    session: 'sign-in-session',
    codeDelivery: { destination: 't***@t***', attribute: 'email' },
  })
})

test('startSignIn passes an optional session through InitiateAuthCommand', async () => {
  const { provider, commands } = createRecordingProvider(async () => ({
    ChallengeName: 'EMAIL_OTP',
    Session: 'next-session',
    ChallengeParameters: { CODE_DELIVERY_DESTINATION: 't***@t***' },
  }))
  await provider.startSignIn('test@example.com', 'prior-session')
  assert.ok(commands[0] instanceof InitiateAuthCommand)
  assert.equal(commands[0].input.Session, 'prior-session')
})

test('startSignIn returns incomplete-challenge without EMAIL_OTP session', async () => {
  const { provider } = createRecordingProvider(async () => ({
    ChallengeName: 'PASSWORD',
    Session: 'other-session',
  }))
  assert.deepEqual(await provider.startSignIn('test@example.com'), { outcome: 'incomplete-challenge' })
})

test('startSignIn converts authentication failures', async () => {
  const cases = [
    new UserNotFoundException({ message: 'missing' }),
    new UserNotConfirmedException({ message: 'unconfirmed' }),
    new NotAuthorizedException({ message: 'denied' }),
  ]
  for (const exception of cases) {
    const { provider } = createRecordingProvider(async () => {
      throw exception
    })
    assert.deepEqual(await provider.startSignIn('test@example.com'), { outcome: 'authentication-failed' })
  }
})

test('startSignIn converts rate-limit exceptions', async () => {
  const { provider: tooMany } = createRecordingProvider(async () => {
    throw new TooManyRequestsException({ message: 'slow down' })
  })
  assert.deepEqual(await tooMany.startSignIn('test@example.com'), { outcome: 'rate-limited' })

  const { provider: limited } = createRecordingProvider(async () => {
    throw new LimitExceededException({ message: 'limit' })
  })
  assert.deepEqual(await limited.startSignIn('test@example.com'), { outcome: 'rate-limited' })
})

test('startSignIn propagates unexpected errors by identity', async () => {
  const unexpected = new Error('sign-in gateway boom')
  const { provider } = createRecordingProvider(async () => {
    throw unexpected
  })
  await assert.rejects(
    () => provider.startSignIn('test@example.com'),
    (error: unknown) => error === unexpected,
  )
})
