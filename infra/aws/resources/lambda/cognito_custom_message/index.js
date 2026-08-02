'use strict'

/**
 * Cognito Custom Message trigger for local/dev E2E.
 * Logs OTP as structured JSON so tests can poll CloudWatch Logs.
 * Still returns the email/SMS templates Cognito requires.
 */
exports.handler = async (event) => {
  const email = event.request.userAttributes?.email ?? ''
  const code = event.request.codeParameter ?? ''

  console.log(
    JSON.stringify({
      type: 'cognito.otp',
      trigger: event.triggerSource,
      email,
      code,
      userName: event.userName,
    }),
  )

  event.response.emailSubject = 'Your verification code'
  event.response.emailMessage = `Your verification code is ${code}.`
  event.response.smsMessage = `Your verification code is ${code}.`
  return event
}
