import test from 'node:test'
import { createAbsentActiveWalkCommands } from '../../../src/infrastructure/walks/absent-active-walk-commands.js'

test('absent ActiveWalkCommands.failIfPresent resolves without work', async () => {
  const commands = createAbsentActiveWalkCommands()
  await commands.failIfPresent({ ownerId: 'owner-1' })
})
