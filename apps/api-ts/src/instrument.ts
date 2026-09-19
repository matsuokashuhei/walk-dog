import * as Sentry from '@sentry/hono/node'
import { loadObservabilityConfig } from './infrastructure/config/index.js'

const config = loadObservabilityConfig(process.env)

if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.environment,
    release: config.release,
  })
}
