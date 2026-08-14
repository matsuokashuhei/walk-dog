import { eq } from 'drizzle-orm'
import type { Owner, OwnerRepository } from '../../../modules/owners/index.js'
import type { DbInstance } from '../client.js'
import { owners } from '../schema/owner.js'

type OwnerRow = typeof owners.$inferSelect

export function createDrizzleOwnerRepository(database: DbInstance): OwnerRepository {
  return {
    resolveByCognitoSubject(cognitoSubject: string): Promise<Owner> {
      return database.transaction(async (trx) => {
        const inserted = await trx
          .insert(owners)
          .values({ cognitoSubject, displayName: null })
          .onConflictDoNothing({ target: owners.cognitoSubject })
          .returning()
        if (inserted.length > 0) {
          return toOwner(inserted[0])
        }
        const existing = await trx
          .select()
          .from(owners)
          .where(eq(owners.cognitoSubject, cognitoSubject))
          .limit(1)
        return toOwner(existing[0])
      })
    },
    updateDisplayName(cognitoSubject: string, displayName: string): Promise<Owner> {
      return database
        .update(owners)
        .set({ displayName })
        .where(eq(owners.cognitoSubject, cognitoSubject))
        .returning()
        .then((rows) => toOwner(rows[0]))
    },
  }
}

function toOwner(row: OwnerRow): Owner {
  return {
    ownerId: row.ownerId,
    displayName: row.displayName,
    avatarUrl: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
