import type { CurrentGoal, Dog } from './types.js'

function toCurrentGoalResponse(currentGoal: CurrentGoal) {
  return {
    goalRevisionId: currentGoal.goalRevisionId,
    period: currentGoal.period,
    minutes: currentGoal.minutes,
    effectiveFrom: currentGoal.effectiveFrom.toISOString(),
    effectiveTo: currentGoal.effectiveTo === null ? null : currentGoal.effectiveTo.toISOString(),
  }
}

export function toDogFields(dog: Dog) {
  return {
    dogId: dog.dogId,
    ownerId: dog.ownerId,
    name: dog.name,
    gender: dog.gender,
    birthday: dog.birthday,
    avatarUrl: dog.avatarUrl,
    createdAt: dog.createdAt.toISOString(),
    updatedAt: dog.updatedAt.toISOString(),
    currentGoal: toCurrentGoalResponse(dog.currentGoal),
  }
}

export function toDogResponse(requestId: string, dog: Dog) {
  return {
    requestId,
    ...toDogFields(dog),
  }
}
