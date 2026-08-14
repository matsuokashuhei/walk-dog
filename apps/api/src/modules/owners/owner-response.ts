import type { Owner } from './types.js'

export function toOwnerResponse(requestId: string, owner: Owner) {
  return {
    requestId,
    ownerId: owner.ownerId,
    displayName: owner.displayName,
    avatarUrl: owner.avatarUrl,
    createdAt: owner.createdAt.toISOString(),
    updatedAt: owner.updatedAt.toISOString(),
  }
}
