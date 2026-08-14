import { and, eq, isNull } from 'drizzle-orm'
import {
  DogNameDuplicateError,
  type CreateDogInput,
  type CurrentGoal,
  type Dog,
  type DogRepository,
} from '../../../modules/dogs/index.js'
import type { DbInstance } from '../client.js'
import { dogs } from '../schema/dog.js'
import { goalRevisions } from '../schema/goal-revision.js'

type DogRow = typeof dogs.$inferSelect
type GoalRevisionRow = typeof goalRevisions.$inferSelect

export function createDrizzleDogRepository(database: DbInstance): DogRepository {
  return {
    listByOwner(ownerId: string): Promise<Dog[]> {
      return selectDogsWithCurrentGoal(database, eq(dogs.ownerId, ownerId)).then((rows) =>
        rows.map((row) => toDog(row.dog, row.revision)),
      )
    },
    async createWithDailyGoal(ownerId: string, input: CreateDogInput): Promise<Dog> {
      try {
        return await database.transaction(async (trx) => {
          const insertedDogs = await trx
            .insert(dogs)
            .values({
              ownerId,
              name: input.name,
              gender: input.gender,
              birthday: input.birthday,
            })
            .returning()
          const dogRow = insertedDogs[0]
          const insertedRevisions = await trx
            .insert(goalRevisions)
            .values({
              dogId: dogRow.dogId,
              period: 'daily',
              minutes: 30,
              effectiveFrom: dogRow.createdAt,
              effectiveTo: null,
            })
            .returning()
          return toDog(dogRow, insertedRevisions[0])
        })
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new DogNameDuplicateError()
        }
        throw error
      }
    },
    getByOwnerAndId(ownerId: string, dogId: string): Promise<Dog | null> {
      return selectDogsWithCurrentGoal(
        database,
        and(eq(dogs.ownerId, ownerId), eq(dogs.dogId, dogId)),
      ).then((rows) =>
        rows.length === 0 ? null : toDog(rows[0].dog, rows[0].revision),
      )
    },
  }
}

function selectDogsWithCurrentGoal(
  database: Pick<DbInstance, 'select'>,
  condition: ReturnType<typeof eq> | ReturnType<typeof and>,
) {
  return database
    .select({
      dog: dogs,
      revision: goalRevisions,
    })
    .from(dogs)
    .innerJoin(
      goalRevisions,
      and(eq(goalRevisions.dogId, dogs.dogId), isNull(goalRevisions.effectiveTo)),
    )
    .where(condition)
}

function toDog(dog: DogRow, revision: GoalRevisionRow): Dog {
  return {
    dogId: dog.dogId,
    ownerId: dog.ownerId,
    name: dog.name,
    gender: dog.gender,
    birthday: dog.birthday as Dog['birthday'],
    avatarUrl: null,
    createdAt: dog.createdAt,
    updatedAt: dog.updatedAt,
    currentGoal: {
      goalRevisionId: revision.goalRevisionId,
      period: revision.period as CurrentGoal['period'],
      minutes: revision.minutes,
      effectiveFrom: revision.effectiveFrom,
      effectiveTo: revision.effectiveTo,
    },
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === '23505'
}
