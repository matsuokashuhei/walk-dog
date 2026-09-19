import type { WalkRepository } from './repository.js'

export interface ActiveWalkCommands {
  failIfPresent(input: { ownerId: string }): Promise<void>
}

type AssertAssignableToActiveWalkCommands<T extends ActiveWalkCommands> = T
export type WalkRepositorySatisfiesActiveWalkCommands = AssertAssignableToActiveWalkCommands<WalkRepository>
