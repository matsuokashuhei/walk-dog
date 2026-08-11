import { createCognitoClient } from '../../../src/infrastructure/cognito/client.js'
import { createCognitoAuthProvider } from '../../../src/infrastructure/cognito/cognito-auth-provider.js'

export const cognitoTestConfig = {
  region: 'ap-northeast-1',
  userPoolId: 'pool-id',
  clientId: 'client-id',
}

export function createRecordingProvider(handler: (command: unknown) => Promise<unknown>) {
  const commands: unknown[] = []
  const cognito = createCognitoClient(cognitoTestConfig, {
    send: async (command: unknown) => {
      commands.push(command)
      return handler(command)
    },
  })
  return {
    provider: createCognitoAuthProvider(cognito),
    commands,
  }
}
