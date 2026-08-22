import { z } from 'zod'

const cognitoConfigSchema = z.object({
  AWS_REGION: z.string().nonempty({ error: 'AWS_REGION must be a non-empty string' }),
  COGNITO_USER_POOL_ID: z.string().nonempty({ error: 'COGNITO_USER_POOL_ID must be a non-empty string' }),
  COGNITO_CLIENT_ID: z.string().nonempty({ error: 'COGNITO_CLIENT_ID must be a non-empty string' }),
})

const databaseConfigSchema = z.object({
  POSTGRES_USER: z.string().nonempty({ error: 'POSTGRES_USER must be a non-empty string' }),
  POSTGRES_PASSWORD: z.string().nonempty({ error: 'POSTGRES_PASSWORD must be a non-empty string' }),
  POSTGRES_DB: z.string().nonempty({ error: 'POSTGRES_DB must be a non-empty string' }),
  POSTGRES_HOST: z.string().nonempty({ error: 'POSTGRES_HOST must be a non-empty string' }),
  POSTGRES_PORT: z.coerce.number().int().positive({ error: 'POSTGRES_PORT must be a positive integer' }),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
})

const sqsConfigSchema = z.object({
  AWS_REGION: z.string().nonempty({ error: 'AWS_REGION must be a non-empty string' }),
  SQS_QUEUE_URL: z.string().nonempty({ error: 'SQS_QUEUE_URL must be a non-empty string' }),
  SQS_ENDPOINT: z.string().optional(),
})


const dynamoDbConfigSchema = z.object({
  AWS_REGION: z.string().nonempty({ error: 'AWS_REGION must be a non-empty string' }),
  DYNAMODB_TABLE: z.string().nonempty({ error: 'DYNAMODB_TABLE must be a non-empty string' }),
  DYNAMODB_ENDPOINT: z.string().optional(),
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

export type DatabaseConfig = {
  user: string
  password: string
  database: string
  host: string
  port: number
  poolMax: number
}

export function loadDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  const config = databaseConfigSchema.parse(env)

  return {
    user: config.POSTGRES_USER,
    password: config.POSTGRES_PASSWORD,
    database: config.POSTGRES_DB,
    host: config.POSTGRES_HOST,
    port: config.POSTGRES_PORT,
    poolMax: config.DATABASE_POOL_MAX,
  }
}

export type SqsConfig = {
  region: string
  queueUrl: string
  endpoint: string | undefined
}

export function loadSqsConfig(env: NodeJS.ProcessEnv): SqsConfig {
  const config = sqsConfigSchema.parse(env)
  const endpoint = config.SQS_ENDPOINT?.trim()

  return {
    region: config.AWS_REGION,
    queueUrl: config.SQS_QUEUE_URL,
    endpoint: endpoint ? endpoint : undefined,
  }
}


export type DynamoDbConfig = {
  region: string
  tableName: string
  endpoint: string | undefined
}

export function loadDynamoDbConfig(env: NodeJS.ProcessEnv): DynamoDbConfig {
  const config = dynamoDbConfigSchema.parse(env)
  const endpoint = config.DYNAMODB_ENDPOINT?.trim()

  return {
    region: config.AWS_REGION,
    tableName: config.DYNAMODB_TABLE,
    endpoint: endpoint ? endpoint : undefined,
  }
}

export function loadCognitoConfig(env: NodeJS.ProcessEnv): {
  region: string
  userPoolId: string
  clientId: string
} {
  const config = cognitoConfigSchema.parse(env)

  return {
    region: config.AWS_REGION,
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
