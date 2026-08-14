import { apiRequest } from '@/lib/api'

export type OwnerResponse = {
  requestId: string
  ownerId: string
  displayName: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

export function getOwner(accessToken: string): Promise<OwnerResponse> {
  return apiRequest<OwnerResponse>('/v1/owner', {
    accessToken,
  })
}

export function updateOwnerDisplayName(
  accessToken: string,
  displayName: string,
): Promise<OwnerResponse> {
  return apiRequest<OwnerResponse>('/v1/owner', {
    method: 'PATCH',
    accessToken,
    body: { displayName },
  })
}
