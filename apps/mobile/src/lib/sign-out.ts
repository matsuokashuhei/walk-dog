import { apiRequest } from '@/lib/api'

export async function signOutRequest(accessToken: string): Promise<void> {
  await apiRequest<void>('/v1/auth/sign-out', {
    method: 'POST',
    accessToken,
  })
}
