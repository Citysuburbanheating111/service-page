import {randomUUID} from 'node:crypto'
import {NextResponse} from 'next/server'

// Each lead is emailed through Resend (RESEND_API_KEY, LEAD_FROM_EMAIL, LEAD_NOTIFICATION_EMAIL) and sent
// to the Zapier webhook (LEAD_WEBHOOK_URL) that creates the client and request in City & Suburban's
// Jobber account. Either one is enough; the visitor is told it was sent if at least one delivery worked.
const allowedFields = ['name', 'email', 'phone', 'address', 'buildingType', 'issue', 'service', 'area', 'form', 'page'] as const
type Lead = Record<(typeof allowedFields)[number], string>
const resendEndpoint = 'https://api.resend.com/emails'
const siteUrl = 'https://citysuburbanheating.com'

function configured(value: string | undefined) {
  return value && !/^(PASTE_|your_)/i.test(value) ? value.trim() : ''
}

function cleanField(value: unknown) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000)
}

function notificationRecipients(value: string) {
  return value.split(',').map((email) => email.trim()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).slice(0, 50)
}

function webhookUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:' ? value : ''
  } catch {
    return ''
  }
}

// The fields Zapier maps into Jobber. Same names as the service area pages send, so one Zap serves both.
function zapierLead(clean: Lead, submitted: Date) {
  const [firstName = '', ...rest] = clean.name.split(' ')
  return {
    source: 'Service page',
    service: clean.service,
    area: clean.area,
    form: clean.form,
    page_url: clean.page.startsWith('/') ? `${siteUrl}${clean.page}` : clean.page,
    first_name: firstName,
    last_name: rest.join(' '),
    full_name: clean.name,
    phone: clean.phone,
    email: clean.email,
    street: clean.address,
    building_type: clean.buildingType,
    issue: clean.issue,
    message: '',
    submitted_at: submitted.toISOString(),
  }
}

async function sendEmail(clean: Lead, submitted: Date, apiKey: string, from: string, recipients: string[]) {
  const subject = `New service page lead: ${clean.service || 'Service'}${clean.area ? ` (${clean.area})` : ''}`.slice(0, 200)
  const text = [
    'New request from a service page',
    '',
    `Name: ${clean.name}`,
    `Email: ${clean.email || 'Not provided'}`,
    `Phone: ${clean.phone}`,
    `Address: ${clean.address || 'Not provided'}`,
    `Building type: ${clean.buildingType || 'Not provided'}`,
    `Request: ${clean.issue || 'Not provided'}`,
    `Service: ${clean.service || 'Not provided'}`,
    `Area: ${clean.area || 'Not provided'}`,
    `Page: ${clean.page || 'Not provided'}`,
    `Submitted: ${submitted.toISOString()}`,
  ].join('\n')

  try {
    const response = await fetch(resendEndpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'Idempotency-Key': `lead/${randomUUID()}`,
      },
      body: JSON.stringify({from, to: recipients, subject, text}),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) console.error('Resend lead delivery failed', {status: response.status})
    return response.ok
  } catch (error: unknown) {
    console.error('Resend lead delivery request failed', {error: error instanceof Error ? error.name : 'UnknownError'})
    return false
  }
}

async function sendToZapier(clean: Lead, submitted: Date, url: string) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(zapierLead(clean, submitted)),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) console.error('Zapier lead delivery failed', {status: response.status})
    return response.ok
  } catch (error: unknown) {
    console.error('Zapier lead delivery request failed', {error: error instanceof Error ? error.name : 'UnknownError'})
    return false
  }
}

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!payload || payload.website) return NextResponse.json({ok: true})
  const clean = Object.fromEntries(allowedFields.map((field) => [field, cleanField(payload[field])])) as Lead
  if (!clean.name || clean.phone.replace(/\D/g, '').length < 7) return NextResponse.json({message: 'A valid name and phone are required'}, {status: 400})

  const apiKey = configured(process.env.RESEND_API_KEY)
  const from = configured(process.env.LEAD_FROM_EMAIL)
  const recipients = notificationRecipients(configured(process.env.LEAD_NOTIFICATION_EMAIL))
  const hook = webhookUrl(configured(process.env.LEAD_WEBHOOK_URL))
  const emailReady = Boolean(apiKey && from && recipients.length)
  if (!emailReady && !hook) return NextResponse.json({message: 'Lead delivery is not configured'}, {status: 503})

  const submitted = new Date()
  const results = await Promise.all([
    emailReady ? sendEmail(clean, submitted, apiKey, from, recipients) : false,
    hook ? sendToZapier(clean, submitted, hook) : false,
  ])
  if (!results.some(Boolean)) return NextResponse.json({message: 'Lead delivery failed'}, {status: 502})
  return NextResponse.json({ok: true})
}
