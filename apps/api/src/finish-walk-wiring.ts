import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  FINISH_CONFIRMATION_TIMEOUT_MS,
  type DynamoDbConfig,
} from './infrastructure/config/index.js'
import { createListConfirmedRecordedAt } from './infrastructure/dynamodb/list-confirmed-recorded-at.js'
import type { OwnerRepository } from './modules/owners/index.js'
import type { FinishWalk, WalkRepository } from './modules/walks/index.js'
import { createFinishWalk } from './modules/walks/use-cases/finish-walk.js'

const finishWalkClock = { now: () => Date.now() }
const finishWalkSleep = {
  sleep: (delayMs: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs)
  }),
}

export function createWiredFinishWalk(
  ownerRepository: OwnerRepository,
  walkRepository: WalkRepository,
  dynamoDbClient: DynamoDBClient,
  dynamoDbConfig: DynamoDbConfig,
): FinishWalk {
  return createFinishWalk(
    ownerRepository,
    walkRepository,
    createListConfirmedRecordedAt(dynamoDbClient, dynamoDbConfig),
    finishWalkClock,
    finishWalkSleep,
    FINISH_CONFIRMATION_TIMEOUT_MS,
  )
}
