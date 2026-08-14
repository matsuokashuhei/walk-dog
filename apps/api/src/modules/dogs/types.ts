export type Birthday =
  | { precision: 'unknown' }
  | { precision: 'year'; year: number }
  | { precision: 'month'; year: number; month: number }
  | { precision: 'day'; year: number; month: number; day: number }

export type CurrentGoal = {
  goalRevisionId: string
  period: 'daily'
  minutes: number
  effectiveFrom: Date
  effectiveTo: Date | null
}

export type Dog = {
  dogId: string
  ownerId: string
  name: string
  gender: 'male' | 'female' | 'unknown'
  birthday: Birthday
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
  currentGoal: CurrentGoal
}

export type CreateDogInput = {
  name: string
  gender: Dog['gender']
  birthday: Birthday
}

export type ListDogs = (cognitoSubject: string) => Promise<Dog[]>

export type CreateDog = (input: {
  cognitoSubject: string
  name: string
  gender: Dog['gender']
  birthday: Birthday
}) => Promise<{ ok: true; dog: Dog } | { ok: false; error: 'duplicate_name' }>

export type GetDog = (input: {
  cognitoSubject: string
  dogId: string
}) => Promise<{ ok: true; dog: Dog } | { ok: false; error: 'not_found' }>
