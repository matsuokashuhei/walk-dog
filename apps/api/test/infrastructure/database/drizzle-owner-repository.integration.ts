import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { eq } from 'drizzle-orm'
import { closeDbClient, createDbClient } from '../../../src/infrastructure/database/client.js'
import { createDrizzleOwnerRepository } from '../../../src/infrastructure/database/repositories/drizzle-owner-repository.js'
import { owners } from '../../../src/infrastructure/database/schema/owner.js'
import { loadDatabaseConfig } from '../../../src/infrastructure/config/index.js'

test('resolveByCognitoSubject is concurrent-safe for the same subject', async () => {
  const config = loadDatabaseConfig(process.env)
  const { db, pool } = createDbClient(config)
  const cognitoSubject = `task3-integration-${randomUUID()}`
  const repository = createDrizzleOwnerRepository(db)

  try {
    const [first, second] = await Promise.all([
      repository.resolveByCognitoSubject(cognitoSubject),
      repository.resolveByCognitoSubject(cognitoSubject),
    ])

    assert.equal(first.ownerId, second.ownerId)
    assert.equal(first.displayName, null)
    assert.equal(first.avatarUrl, null)

    const rows = await db.select().from(owners).where(eq(owners.cognitoSubject, cognitoSubject))
    assert.equal(rows.length, 1)
    assert.equal(rows[0].ownerId, first.ownerId)
  } finally {
    try {
      await db.delete(owners).where(eq(owners.cognitoSubject, cognitoSubject))
    } finally {
      await closeDbClient(pool)
    }
  }
})
