import { z } from 'zod'

const databaseConfigSchema = z.object({
  DATABASE_URL: z.string({ error: 'DATABASE_URL is required' }).min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
})

export function loadDatabaseConfig(env: NodeJS.ProcessEnv): { databaseUrl: string; poolMax: number } {
  const config = databaseConfigSchema.parse(env)

  return {
    databaseUrl: config.DATABASE_URL,
    poolMax: config.DATABASE_POOL_MAX,
  }
}
