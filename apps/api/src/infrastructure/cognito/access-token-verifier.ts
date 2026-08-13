import { CognitoJwtVerifier } from 'aws-jwt-verify'
import type { AccessTokenVerifier } from '../../shared/http/access-token.js'

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
    async verify(accessToken: string) {
      const payload = await cognitoVerifier.verify(accessToken)
      return { cognitoSubject: payload.sub }
    },
  }
}
