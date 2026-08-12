import { CognitoJwtVerifier } from 'aws-jwt-verify'

export type Principal = {
  cognitoSubject: string
}

export type AccessTokenVerifier = {
  verify(accessToken: string): Promise<Principal>
}

export function createAccessTokenVerifier(config: {
  region: string
  userPoolId: string
  clientId: string
}): AccessTokenVerifier {
  const cognitoVerifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'access',
    clientId: config.clientId,
  })

  return {
    async verify(accessToken: string): Promise<Principal> {
      const payload = await cognitoVerifier.verify(accessToken)
      return { cognitoSubject: payload.sub }
    },
  }
}
