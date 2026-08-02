/**
 * Maestro runScript helper.
 * Env: MAILOSAUR_API_KEY, MAILOSAUR_SERVER_ID, MAILOSAUR_EMAIL
 * Writes OTP into output.OTP for subsequent Maestro steps.
 */
const apiKey = MAILOSAUR_API_KEY
const serverId = MAILOSAUR_SERVER_ID
const email = MAILOSAUR_EMAIL

if (!apiKey || !serverId || !email) {
  throw new Error('MAILOSAUR_API_KEY, MAILOSAUR_SERVER_ID, and MAILOSAUR_EMAIL are required')
}

const deadline = Date.now() + 60000
let otp = null

while (Date.now() < deadline && !otp) {
  const url =
    'https://mailosaur.com/api/messages/search?server=' +
    encodeURIComponent(serverId) +
    '&receivedAfter=' +
    encodeURIComponent(String(Date.now() - 120000))

  const response = http.request(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + java.util.Base64.encoder.encodeToString(new java.lang.String(apiKey + ':').getBytes('UTF-8')),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sentTo: email,
    }),
  })

  if (response.statusCode === 200) {
    const payload = json(response.body)
    const items = payload.items || []
    for (let i = 0; i < items.length; i++) {
      const subject = items[i].subject || ''
      const text = (items[i].text && items[i].text.body) || ''
      const haystack = subject + ' ' + text
      const match = haystack.match(/\b(\d{6})\b/)
      if (match) {
        otp = match[1]
        break
      }
    }
  }

  if (!otp) {
    Thread.sleep(2000)
  }
}

if (!otp) {
  throw new Error('Timed out waiting for Mailosaur OTP')
}

output.OTP = otp
