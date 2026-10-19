import {randomUUID} from 'node:crypto'
import {NextResponse} from 'next/server'

const allowedFields = ['name', 'email', 'phone', 'address', 'buildingType', 'issue', 'service', 'area'] as const
const resendEndpoint = 'https://api.resend.com/emails'

function configured(value: string | undefined) {
  return value && !/^(PASTE_|your_)/i.test(value) ? value.trim() : ''
}

function cleanField(value: unknown) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000)
}

function notificationRecipients(value: string) {
  return value.split(',').map((email) => email.trim()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).slice(0, 50)
}

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!payload || payload.website) return NextResponse.json({ok: true})
  const clean = Object.fromEntries(allowedFields.map((field) => [field, cleanField(payload[field])])) as Record<(typeof allowedFields)[number], string>
  if (!clean.name || clean.phone.replace(/\D/g, '').length < 7) return NextResponse.json({message: 'A valid name and phone are required'}, {status: 400})

  const apiKey = configured(process.env.RESEND_API_KEY)
  const from = configured(process.env.LEAD_FROM_EMAIL)
  const recipients = notificationRecipients(configured(process.env.LEAD_NOTIFICATION_EMAIL))
  if (!apiKey || !from || !recipients.length) return NextResponse.json({message: 'Lead email delivery is not configured'}, {status: 503})

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
    `Submitted: ${new Date().toISOString()}`,
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
    if (!response.ok) {
      console.error('Resend lead delivery failed', {status: response.status})
      return NextResponse.json({message: 'Lead email delivery failed'}, {status: 502})
    }
    return NextResponse.json({ok: true})
  } catch (error: unknown) {
    console.error('Resend lead delivery request failed', {error: error instanceof Error ? error.name : 'UnknownError'})
    return NextResponse.json({message: 'Lead email delivery failed'}, {status: 502})
  }
}
