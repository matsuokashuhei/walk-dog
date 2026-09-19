import type { OwnerRepository } from '../../owners/index.js'
import { WalkNotFoundError } from '../errors.js'
import type { ConfirmedTrackPoints } from '../provider.js'
import type { WalkRepository } from '../repository.js'
import type { GetWalkDetail } from '../types.js'

export function createGetWalkDetail(
  owners: OwnerRepository,
  walks: WalkRepository,
  confirmed: ConfirmedTrackPoints,
): GetWalkDetail {
  return async (input) => {
    const owner = await owners.resolveByCognitoSubject(input.cognitoSubject)
    try {
      const walk = await walks.getCompletedByOwner({
        ownerId: owner.ownerId,
        walkId: input.walkId,
      })
      const [trackPoints, events] = await Promise.all([
        confirmed.listPoints(input.walkId),
        walks.listEvents({ walkId: input.walkId }),
      ])
      return {
        ok: true,
        detail: {
          ...walk,
          trackPoints,
          events,
        },
      }
    } catch (error) {
      if (error instanceof WalkNotFoundError) {
        return { ok: false, error: 'not_found' }
      }
      throw error
    }
  }
}
