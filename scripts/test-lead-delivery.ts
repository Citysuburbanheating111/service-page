import assert from 'node:assert/strict'
import {POST} from '../src/app/api/lead/route'

const originalFetch = global.fetch
const originalEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  LEAD_FROM_EMAIL: process.env.LEAD_FROM_EMAIL,
  LEAD_NOTIFICATION_EMAIL: process.env.LEAD_NOTIFICATION_EMAIL,
}

function leadRequest(payload: Record<string, unknown>) {
  return new Request('http://localhost/api/lead', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(payload),
  })
}

async function run() {
  process.env.RESEND_API_KEY = 're_test_key'
  process.env.LEAD_FROM_EMAIL = 'City & Suburban Heating & Cooling <leads@updates.example.com>'
  process.env.LEAD_NOTIFICATION_EMAIL = 'dispatch@example.com, owner@example.com'

  let capturedUrl = ''
  let capturedInit: RequestInit | undefined
  global.fetch = async (input, init) => {
    capturedUrl = String(input)
    capturedInit = init
    return new Response(JSON.stringify({id: 'email_test_123'}), {status: 200, headers: {'content-type': 'application/json'}})
  }

  const success = await POST(leadRequest({
    name: 'QA Customer',
    email: 'qa@example.com',
    phone: '(773) 555-0100',
    address: 'Lincoln & Foster',
    buildingType: 'Two-flat or three-flat',
    issue: 'Quote only',
    service: 'Generator Installation',
    area: 'Chicago',
  }))
  assert.equal(success.status, 200)
  assert.equal(capturedUrl, 'https://api.resend.com/emails')
  assert.equal(capturedInit?.method, 'POST')
  const headers = capturedInit?.headers as Record<string, string>
  assert.equal(headers.authorization, 'Bearer re_test_key')
  assert.match(headers['Idempotency-Key'], /^lead\/[0-9a-f-]{36}$/)
  const email = JSON.parse(String(capturedInit?.body)) as {from: string; to: string[]; subject: string; text: string}
  assert.equal(email.from, 'City & Suburban Heating & Cooling <leads@updates.example.com>')
  assert.deepEqual(email.to, ['dispatch@example.com', 'owner@example.com'])
  assert.equal(email.subject, 'New service page lead: Generator Installation (Chicago)')
  assert.match(email.text, /Name: QA Customer/)
  assert.match(email.text, /Email: qa@example.com/)
  assert.match(email.text, /Phone: \(773\) 555-0100/)
  assert.match(email.text, /Request: Quote only/)

  global.fetch = async () => new Response(null, {status: 429})
  const upstreamFailure = await POST(leadRequest({name: 'QA Customer', phone: '7735550100'}))
  assert.equal(upstreamFailure.status, 502)

  delete process.env.RESEND_API_KEY
  const unconfigured = await POST(leadRequest({name: 'QA Customer', phone: '7735550100'}))
  assert.equal(unconfigured.status, 503)

  const invalid = await POST(leadRequest({name: 'QA Customer', phone: '123'}))
  assert.equal(invalid.status, 400)

  console.log('Lead delivery test passed: Resend request, recipients, content, idempotency, validation, and failure handling.')
}

run().finally(() => {
  global.fetch = originalFetch
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}).catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
