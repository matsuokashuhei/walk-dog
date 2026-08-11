import pino from 'pino'
import type { Logger } from '../../src/infrastructure/observability/logger.js'

export const testLogger: Logger = pino({
  level: 'silent',
  base: {
    service: 'api',
    environment: 'test',
    release: 'test',
  },
})
