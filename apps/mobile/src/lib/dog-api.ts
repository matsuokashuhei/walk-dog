import { apiRequest } from '@/lib/api'

export type Birthday =
  | { precision: 'unknown' }
  | { precision: 'year'; year: number }
  | { precision: 'month'; year: number; month: number }
  | { precision: 'day'; year: number; month: number; day: number }

export type CurrentGoalResponse = {
  goalRevisionId: string
  period: 'daily'
  minutes: number
  effectiveFrom: string
  effectiveTo: string | null
}

export type DogResponse = {
  requestId: string
  dogId: string
  ownerId: string
  name: string
  gender: 'male' | 'female' | 'unknown'
  birthday: Birthday
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
  currentGoal: CurrentGoalResponse
}

export function listDogs(
  accessToken: string,
): Promise<{ requestId: string; dogs: Omit<DogResponse, 'requestId'>[] }> {
  return apiRequest<{ requestId: string; dogs: Omit<DogResponse, 'requestId'>[] }>('/v1/dogs', {
    accessToken,
  })
}

export function createDog(
  accessToken: string,
  body: { name: string; gender: DogResponse['gender']; birthday?: Birthday },
): Promise<DogResponse> {
  return apiRequest<DogResponse>('/v1/dogs', {
    method: 'POST',
    accessToken,
    body,
  })
}

export function getDog(accessToken: string, dogId: string): Promise<DogResponse> {
  return apiRequest<DogResponse>(`/v1/dogs/${dogId}`, {
    accessToken,
  })
}
