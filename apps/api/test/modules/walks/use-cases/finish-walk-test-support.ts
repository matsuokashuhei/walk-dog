import { createHash } from 'node:crypto'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'
import type { ConfirmedTrackPoints } from '../../../../src/modules/walks/provider.js'
import type { WalkRepository } from '../../../../src/modules/walks/repository.js'
import type { CompletedWalk, FinishWalkInput } from '../../../../src/modules/walks/types.js'
import { createFinishWalk } from '../../../../src/modules/walks/use-cases/finish-walk.js'

export const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

export const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'
export const idempotencyKey = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e91'
export const bodyHash = createHash('sha256').update('{}').digest('hex')
export const recordedAt = new Date('2026-09-06T03:12:14.000Z')

export const walk: CompletedWalk = {
  walkId,
  ownerId: owner.ownerId,
  state: 'completed',
  startedAt: new Date('2026-08-15T03:12:04.000Z'),
  completedAt: new Date('2026-08-15T03:44:04.000Z'),
  durationSeconds: 1920,
  distanceMeters: 0,
  paceSecondsPerMeter: null,
  participants: [
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e81',
      dogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
      name: 'Mugi',
    },
  ],
}

export const finishInput = {
  cognitoSubject: 'sub-1',
  walkId,
  idempotencyKey,
}

function ownersFake(resolve: OwnerRepository['resolveByCognitoSubject']): OwnerRepository {
  return {
    resolveByCognitoSubject: resolve,
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }
}

function walksFake(opts: {
  finish: WalkRepository['finish']
  listAccepted: WalkRepository['listAcceptedRecordedAt']
}): WalkRepository {
  return {
    async getActiveByOwner() {
      throw new Error('unexpected getActiveByOwner')
    },
    async getCompletedByOwner() {
      throw new Error('unexpected getCompletedByOwner')
    },
    async start() {
      throw new Error('unexpected start')
    },
    finish: opts.finish,
    async fail() {
      throw new Error('unexpected fail')
    },
    async failIfPresent() {
      throw new Error('unexpected failIfPresent')
    },
    async acceptTrackPoint() {
      throw new Error('unexpected acceptTrackPoint')
    },
    listAcceptedRecordedAt: opts.listAccepted,
    async listEvents() {
      throw new Error('unexpected listEvents')
    },
    async recordEvent() {
      throw new Error('unexpected recordEvent')
    },
  }
}

export function createFinishWalkSut(opts: {
  listAccepted?: WalkRepository['listAcceptedRecordedAt']
  finish?: WalkRepository['finish']
  listConfirmed?: ConfirmedTrackPoints['listRecordedAt']
  listPoints?: ConfirmedTrackPoints['listPoints']
  nowValues?: number[]
  sleepCalls?: number[]
  resolveByCognitoSubject?: OwnerRepository['resolveByCognitoSubject']
} = {}) {
  const remainingNow = [...(opts.nowValues ?? [])]
  const finishCalls: FinishWalkInput[] = []
  const confirmedCalls: string[] = []
  const listPointsCalls: string[] = []
  const listAcceptedCalls: { ownerId: string; walkId: string }[] = []
  const finishWalk = createFinishWalk(
    ownersFake(opts.resolveByCognitoSubject ?? (async () => owner)),
    walksFake({
      async listAccepted(input) {
        listAcceptedCalls.push(input)
        if (opts.listAccepted) {
          return opts.listAccepted(input)
        }
        return []
      },
      async finish(input) {
        finishCalls.push(input)
        if (opts.finish) {
          return opts.finish(input)
        }
        return {
          ...walk,
          distanceMeters: input.distanceMeters,
          paceSecondsPerMeter: input.distanceMeters > 0
            ? walk.durationSeconds / input.distanceMeters
            : null,
        }
      },
    }),
    {
      async listRecordedAt(targetWalkId) {
        confirmedCalls.push(targetWalkId)
        if (opts.listConfirmed) {
          return opts.listConfirmed(targetWalkId)
        }
        throw new Error('unexpected listRecordedAt')
      },
      async listPoints(targetWalkId) {
        listPointsCalls.push(targetWalkId)
        if (opts.listPoints) {
          return opts.listPoints(targetWalkId)
        }
        throw new Error('unexpected listPoints')
      },
    },
    {
      now() {
        const next = remainingNow.shift()
        if (next === undefined) {
          return 0
        }
        return next
      },
    },
    {
      async sleep(durationMs) {
        opts.sleepCalls?.push(durationMs)
      },
    },
    30_000,
  )
  return { finishWalk, finishCalls, confirmedCalls, listPointsCalls, listAcceptedCalls }
}
