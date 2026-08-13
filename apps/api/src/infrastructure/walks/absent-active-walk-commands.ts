import type { ActiveWalkCommands } from '../../modules/walks/active-walk-commands.js'

export function createAbsentActiveWalkCommands(): ActiveWalkCommands {
  return {
    async failIfPresent() {},
  }
}
