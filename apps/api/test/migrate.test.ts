import assert from 'node:assert/strict'
import test from 'node:test'
import { runMigrations } from '../src/db/migrate.js'

test('logs the failing migration and PostgreSQL result before propagating the error', async () => {
  const failedQuery = `CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cognito_subject" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_cognito_subject_unique" UNIQUE("cognito_subject")
);`
  const postgresError = Object.assign(new Error('relation "owners" already exists'), {
    severity: 'ERROR',
    code: '42P07',
    detail: 'Relation already exists in schema public.',
    schema: 'public',
    table: 'owners',
  })
  const migrationError = Object.assign(new Error('Failed query'), {
    query: failedQuery,
    cause: postgresError,
  })
  const output: string[] = []
  const client = {
    connect: async () => {},
    query: async () => ({ rows: [] }),
    end: async () => {},
  }

  await assert.rejects(
    runMigrations(
      { databaseUrl: 'postgresql://unused' },
      {
        createClient: () => client,
        applyMigrations: async () => { throw migrationError },
        writeOutput: (line) => { output.push(line) },
      },
    ),
    (error) => error === migrationError,
  )

  assert.equal(output.length, 1)
  assert.deepEqual(JSON.parse(output[0]!), {
    event: 'migration_failed',
    migrationVersion: '0000_owners',
    pendingVersions: ['0000_owners'],
    postgresResult: {
      name: 'Error',
      message: 'relation "owners" already exists',
      severity: 'ERROR',
      code: '42P07',
      detail: 'Relation already exists in schema public.',
      schema: 'public',
      table: 'owners',
    },
  })
})
