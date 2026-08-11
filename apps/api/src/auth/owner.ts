import { createDrizzleOwnerRepository } from '../infrastructure/database/repositories/drizzle-owner-repository.js'
import type { DbInstance } from '../infrastructure/database/client.js'
import type { Owner } from '../modules/owners/index.js'

type JwtPayload = { sub: string }

export function decodeIdTokenSubject(idToken: string): string {
  const parts = idToken.split('.')
  const payload = parts[1]
  if (!payload) {
    throw new Error('Invalid ID token format')
  }
  const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')) as JwtPayload
  return decoded.sub
}

export function ownerFromCognitoSubject(
  database: DbInstance,
  cognitoSubject: string,
): Promise<Owner> {
  return createDrizzleOwnerRepository(database).resolveByCognitoSubject(cognitoSubject)
}

export function toAuthenticationResponse(
  requestId: string,
  tokens: { accessToken: string; idToken: string; refreshToken: string },
  owner: Owner,
) {
  return {
    requestId,
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
    owner: {
      ownerId: owner.ownerId,
      displayName: owner.displayName,
      avatarUrl: owner.avatarUrl,
      createdAt: owner.createdAt.toISOString(),
      updatedAt: owner.updatedAt.toISOString(),
    },
  }
}
