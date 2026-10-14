import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'

function loadLocalEnv() {
  const envPath = path.resolve('.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    process.env[match[1]] ||= match[2].replace(/^['"]|['"]$/g, '')
  }
}

loadLocalEnv()

const projectId = process.env.NEXT_SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'boolyxr0'
const dataset = process.env.NEXT_SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token || /^(PASTE_|your_)/i.test(token)) throw new Error('Add a Sanity Editor token to SANITY_API_WRITE_TOKEN in .env.local')

const client = createClient({projectId, dataset, apiVersion: '2026-03-01', token, useCdn: false})
const templateId = 'servicePageTemplate-standard-v1'
const presentation = {
  footerColor: '#09263A',
  accentColor: '#DD382B',
  accentDarkColor: '#B92E23',
  actionBlueColor: '#0A4265',
  equalHeightReviewCards: true,
  ratingAfterReviewText: true,
  coverageMapFirst: true,
  neighborhoodGrid: true,
  brandLogoCards: true,
  pricingHeadingAsQuestion: true,
}

async function main() {
  const before = await client.fetch<{pageCount: number; standardTemplateRefs: number}>(`{
    "pageCount": count(*[_type == "servicePage"]),
    "standardTemplateRefs": count(*[_type == "servicePage" && template._ref == $templateId])
  }`, {templateId})

  if (before.pageCount !== before.standardTemplateRefs) {
    throw new Error(`Expected every service page to use ${templateId}; found ${before.standardTemplateRefs} of ${before.pageCount}`)
  }

  const result = await client.transaction()
    .patch(templateId, (patch) => patch.set({version: '1.1.0', active: true, presentation}))
    .patch('siteSettings', (patch) => patch.set({
      brand: {
        primary: '#09263A',
        dark: '#061B29',
        light: '#EEF4F7',
        secondary: '#0A4265',
        accent: '#DD382B',
        accentDark: '#B92E23',
      },
    }))
    .commit()

  const after = await client.fetch(`{
    "template": *[_id == $templateId][0]{version, active, presentation},
    "brand": *[_id == "siteSettings"][0].brand,
    "standardTemplateRefs": count(*[_type == "servicePage" && template._ref == $templateId])
  }`, {templateId})

  console.log(JSON.stringify({transactionId: result.transactionId, ...after}, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
