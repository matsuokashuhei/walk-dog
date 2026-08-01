import { z } from 'zod'

const databaseConfigSchema = z.object({
  DATABASE_URL: z
    .url({
      error: (issue) => issue.input === undefined
        ? 'DATABASE_URL is required'
        : 'DATABASE_URL must be a valid URL',
    })
    .refine((value) => value.startsWith('postgresql://'), {
      error: 'DATABASE_URL must be a PostgreSQL URL',
    }),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
})

export function loadDatabaseConfig(env: NodeJS.ProcessEnv): { databaseUrl: string; poolMax: number } {
  const config = databaseConfigSchema.parse(env)

  return {
    databaseUrl: config.DATABASE_URL,
    poolMax: config.DATABASE_POOL_MAX,
  }
}
