import pino, { type DestinationStream, type Logger } from 'pino'

export type LoggerConfig = {
  environment: string
  release: string
}

export function createLogger(
  config: LoggerConfig,
  destination: DestinationStream = pino.destination(1),
): Logger {
  return pino(
    {
      base: {
        service: 'api',
        environment: config.environment,
        release: config.release,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  )
}

export type { Logger }
