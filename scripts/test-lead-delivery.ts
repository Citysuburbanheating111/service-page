import assert from 'node:assert/strict'
import {POST} from '../src/app/api/lead/route'

const originalFetch = global.fetch
const originalEnv = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  LEAD_FROM_EMAIL: process.env.LEAD_FROM_EMAIL,
  LEAD_NOTIFICATION_EMAIL: process.env.LEAD_NOTIFICATION_EMAIL,
  LEAD_WEBHOOK_URL: process.env.LEAD_WEBHOOK_URL,
}

function leadRequest(payload: Record<string, unknown>) {
  return new Request('http://localhost/api/lead', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(payload),
  })
}

async function run() {
  delete process.env.LEAD_WEBHOOK_URL
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

  // With the Zapier webhook set, each lead goes to email and to Zapier (for Jobber) at the same time
  const hook = 'https://hooks.zapier.com/hooks/catch/123/test/'
  process.env.RESEND_API_KEY = 're_test_key'
  process.env.LEAD_WEBHOOK_URL = hook
  const calls: {url: string; body: string}[] = []
  global.fetch = async (input, init) => {
    calls.push({url: String(input), body: String(init?.body)})
    return new Response('{}', {status: 200})
  }
  const both = await POST(leadRequest({
    name: 'Mary Ann Smith', email: 'qa@example.com', phone: '(773) 555-0100', address: 'Lincoln & Foster',
    buildingType: 'Bungalow', issue: 'No heat', service: 'Heater repair', area: 'Chicago',
    form: 'Booking form', page: '/services/heating/heater-repair/',
  }))
  assert.equal(both.status, 200)
  assert.deepEqual(calls.map((c) => c.url).sort(), ['https://api.resend.com/emails', hook])
  const zap = JSON.parse(calls.find((c) => c.url === hook)!.body) as Record<string, string>
  assert.deepEqual(Object.keys(zap).sort(), ['area', 'building_type', 'email', 'first_name', 'form', 'full_name', 'issue', 'last_name',
    'message', 'page_url', 'phone', 'service', 'source', 'street', 'submitted_at'])
  assert.equal(zap.source, 'Service page')
  assert.equal(zap.first_name, 'Mary')
  assert.equal(zap.last_name, 'Ann Smith')
  assert.equal(zap.email, 'qa@example.com')
  assert.equal(zap.phone, '(773) 555-0100')
  assert.equal(zap.street, 'Lincoln & Foster')
  assert.equal(zap.building_type, 'Bungalow')
  assert.equal(zap.issue, 'No heat')
  assert.equal(zap.service, 'Heater repair')
  assert.equal(zap.form, 'Booking form')
  assert.equal(zap.page_url, 'https://citysuburbanheating.com/services/heating/heater-repair/')
  const emailBody = JSON.parse(calls.find((c) => c.url !== hook)!.body) as {text: string}
  assert.match(emailBody.text, /Page: \/services\/heating\/heater-repair\//)

  // Zapier only (email not set up yet): still accepted
  delete process.env.RESEND_API_KEY
  calls.length = 0
  assert.equal((await POST(leadRequest({name: 'QA', phone: '7735550100'}))).status, 200)
  assert.deepEqual(calls.map((c) => c.url), [hook])

  // One delivery failing does not lose the lead; both failing does
  process.env.RESEND_API_KEY = 're_test_key'
  for (const failing of ['https://api.resend.com/emails', hook]) {
    global.fetch = async (input) => String(input) === failing ? new Response(null, {status: 500}) : new Response('{}', {status: 200})
    assert.equal((await POST(leadRequest({name: 'QA', phone: '7735550100'}))).status, 200, `accepted when only ${failing} fails`)
  }
  global.fetch = async () => { throw new TypeError('fetch failed') }
  assert.equal((await POST(leadRequest({name: 'QA', phone: '7735550100'}))).status, 502)

  // A webhook value that is not an https address is ignored
  delete process.env.RESEND_API_KEY
  process.env.LEAD_WEBHOOK_URL = 'http://hooks.zapier.com/x'
  assert.equal((await POST(leadRequest({name: 'QA', phone: '7735550100'}))).status, 503)

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
