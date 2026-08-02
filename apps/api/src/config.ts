import { z } from 'zod'

const cognitoConfigSchema = z.object({
  COGNITO_REGION: z.string().min(1, { error: 'COGNITO_REGION must be a non-empty string' }),
  COGNITO_USER_POOL_ID: z.string().min(1, { error: 'COGNITO_USER_POOL_ID must be a non-empty string' }),
  COGNITO_CLIENT_ID: z.string().min(1, { error: 'COGNITO_CLIENT_ID must be a non-empty string' }),
})

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

const observabilityConfigSchema = z.object({
  ENVIRONMENT: z.string({
    error: (issue) => issue.input === undefined
      ? 'ENVIRONMENT is required'
      : 'ENVIRONMENT must be a non-empty string',
  }).min(1, { error: 'ENVIRONMENT must be a non-empty string' }),
  RELEASE: z.string({
    error: (issue) => issue.input === undefined
      ? 'RELEASE is required'
      : 'RELEASE must be a non-empty string',
  }).min(1, { error: 'RELEASE must be a non-empty string' }),
  SENTRY_DSN: z.string().optional(),
})

export function loadDatabaseConfig(env: NodeJS.ProcessEnv): { databaseUrl: string; poolMax: number } {
  const config = databaseConfigSchema.parse(env)

  return {
    databaseUrl: config.DATABASE_URL,
    poolMax: config.DATABASE_POOL_MAX,
  }
}

export function loadCognitoConfig(env: NodeJS.ProcessEnv): {
  region: string
  userPoolId: string
  clientId: string
} {
  const config = cognitoConfigSchema.parse(env)

  return {
    region: config.COGNITO_REGION,
    userPoolId: config.COGNITO_USER_POOL_ID,
    clientId: config.COGNITO_CLIENT_ID,
  }
}

export function loadObservabilityConfig(env: NodeJS.ProcessEnv): {
  environment: string
  release: string
  sentryDsn: string | undefined
} {
  const config = observabilityConfigSchema.parse(env)
  const sentryDsn = config.SENTRY_DSN?.trim()

  return {
    environment: config.ENVIRONMENT,
    release: config.RELEASE,
    sentryDsn: sentryDsn ? sentryDsn : undefined,
  }
}
