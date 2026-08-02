/**
 * Maestro runScript: invoke Node CloudWatch OTP poller.
 * Env: E2E_EMAIL, AWS_PROFILE/AWS_REGION as needed.
 * Maestro cwd should be apps/mobile.
 */
const email = typeof E2E_EMAIL === 'undefined' ? null : E2E_EMAIL
if (!email) {
  throw new Error('E2E_EMAIL is required')
}

const script = '.maestro/scripts/fetch-cognito-otp.mjs'
const pb = new java.lang.ProcessBuilder(['node', script])
pb.redirectErrorStream(true)
pb.directory(new java.io.File('.'))
pb.environment().put('E2E_EMAIL', String(email))
if (typeof AWS_PROFILE !== 'undefined' && AWS_PROFILE) {
  pb.environment().put('AWS_PROFILE', String(AWS_PROFILE))
}
if (typeof AWS_REGION !== 'undefined' && AWS_REGION) {
  pb.environment().put('AWS_REGION', String(AWS_REGION))
}
if (typeof COGNITO_OTP_LOG_GROUP !== 'undefined' && COGNITO_OTP_LOG_GROUP) {
  pb.environment().put('COGNITO_OTP_LOG_GROUP', String(COGNITO_OTP_LOG_GROUP))
}

const proc = pb.start()
const reader = new java.io.BufferedReader(
  new java.io.InputStreamReader(proc.getInputStream()),
)
let line
let stdout = ''
while ((line = reader.readLine()) !== null) {
  stdout += line
}
const exitCode = proc.waitFor()
if (exitCode !== 0) {
  throw new Error('fetch-cognito-otp failed: ' + stdout)
}
const otp = stdout.trim()
if (!/^\d{4,8}$/.test(otp)) {
  throw new Error('Unexpected OTP output: ' + otp)
}
output.OTP = otp
