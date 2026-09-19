import type { CreateDogInput, Dog } from './types.js'

export interface DogRepository {
  listByOwner(ownerId: string): Promise<Dog[]>
  createWithDailyGoal(ownerId: string, input: CreateDogInput): Promise<Dog>
  getByOwnerAndId(ownerId: string, dogId: string): Promise<Dog | null>
}
