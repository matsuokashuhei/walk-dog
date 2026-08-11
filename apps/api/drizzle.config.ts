import { defineConfig } from 'drizzle-kit'

const host = process.env.POSTGRES_HOST ?? ''
const port = process.env.POSTGRES_PORT ?? ''
const user = process.env.POSTGRES_USER ?? ''
const password = process.env.POSTGRES_PASSWORD ?? ''
const database = process.env.POSTGRES_DB ?? ''

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/*.ts',
  out: './drizzle',
  dbCredentials: {
    url: `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`,
  },
  migrations: {
    schema: 'drizzle',
  },
})
