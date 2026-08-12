export interface ActiveWalkCommands {
  failIfPresent(input: { ownerId: string }): Promise<void>
}
