import { eq } from 'drizzle-orm'
import type { DbInstance } from '../db/client.js'
import { owners } from '../schema/owner.js'

type JwtPayload = { sub: string }

export function decodeIdTokenSubject(idToken: string): string {
  const parts = idToken.split('.')
  const payload = parts[1]
  if (!payload) {
    throw new Error('Invalid ID token format')
  }
  const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')) as JwtPayload
  return decoded.sub
}

export function ownerFromCognitoSubject(
  database: DbInstance,
  cognitoSubject: string,
): Promise<{ ownerId: string; createdAt: Date; updatedAt: Date }> {
  return database.transaction(async (trx) => {
    const inserted = await trx.insert(owners).values({ cognitoSubject, displayName: null }).onConflictDoNothing().returning()
    if (inserted.length > 0) {
      return { ownerId: inserted[0].ownerId, createdAt: inserted[0].createdAt, updatedAt: inserted[0].updatedAt }
    }
    const existing = await trx.select().from(owners).where(eq(owners.cognitoSubject, cognitoSubject)).limit(1)
    return { ownerId: existing[0].ownerId, createdAt: existing[0].createdAt, updatedAt: existing[0].updatedAt }
  })
}
