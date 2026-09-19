import * as Sentry from '@sentry/hono/node'

export function setRequestIdTag(requestId: string): void {
  Sentry.getIsolationScope().setTag('requestId', requestId)
}

export async function closeSentry(): Promise<void> {
  await Sentry.close(2000)
}
