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
