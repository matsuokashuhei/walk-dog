import type { Authentication } from './types.js'
import type { Owner } from '../owners/index.js'

export function toAuthenticationResponse(
  requestId: string,
  authentication: Authentication,
  owner: Owner,
) {
  return {
    requestId,
    accessToken: authentication.accessToken,
    idToken: authentication.idToken,
    refreshToken: authentication.refreshToken,
    owner: {
      ownerId: owner.ownerId,
      displayName: owner.displayName,
      avatarUrl: owner.avatarUrl,
      createdAt: owner.createdAt.toISOString(),
      updatedAt: owner.updatedAt.toISOString(),
    },
  }
}
