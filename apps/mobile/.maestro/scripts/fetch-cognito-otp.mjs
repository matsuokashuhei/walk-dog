#!/usr/bin/env node
/**
 * Poll CloudWatch Logs for Cognito Custom Message OTP entries.
 *
 * Env:
 *   E2E_EMAIL (required)
 *   AWS_PROFILE (default: walk-dog)
 *   AWS_REGION (default: ap-northeast-1)
 *   COGNITO_OTP_LOG_GROUP (default: /aws/lambda/walkdog-local-cognito-custom-message)
 *   COGNITO_OTP_WAIT_MS (default: 60000)
 */
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs'

const email = process.env.E2E_EMAIL
if (!email) {
  console.error('E2E_EMAIL is required')
  process.exit(1)
}

const region = process.env.AWS_REGION ?? 'ap-northeast-1'
const logGroup =
  process.env.COGNITO_OTP_LOG_GROUP ??
  '/aws/lambda/walkdog-local-custom-message'
const waitMs = Number(process.env.COGNITO_OTP_WAIT_MS ?? '60000')
const startedAt = Date.now() - 30_000

const client = new CloudWatchLogsClient({ region })

function extractOtp(message) {
  try {
    const payload = JSON.parse(message)
    if (payload.type === 'cognito.otp' && payload.email === email && payload.code) {
      return String(payload.code)
    }
  } catch {
    // ignore non-JSON lines
  }
  return null
}

async function findOtp() {
  const response = await client.send(
    new FilterLogEventsCommand({
      logGroupName: logGroup,
      startTime: startedAt,
      filterPattern: '"cognito.otp"',
    }),
  )
  const events = response.events ?? []
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const otp = extractOtp(events[i]?.message ?? '')
    if (otp) {
      return otp
    }
  }
  return null
}

const deadline = Date.now() + waitMs
while (Date.now() < deadline) {
  const otp = await findOtp()
  if (otp) {
    process.stdout.write(otp)
    process.exit(0)
  }
  await new Promise((resolve) => setTimeout(resolve, 2000))
}

console.error(`Timed out waiting for OTP for ${email} in ${logGroup}`)
process.exit(1)
