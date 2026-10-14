import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'

function loadLocalEnv() {
  const envPath = path.resolve('.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 1) continue
    const key = trimmed.slice(0, separator)
    const value = trimmed.slice(separator + 1).replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()

const projectId = process.env.NEXT_SANITY_PROJECT_ID || 'boolyxr0'
const dataset = process.env.NEXT_SANITY_DATASET || 'production'
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token || /^(PASTE_|your_)/i.test(token)) throw new Error('A configured Sanity token is required')

const pageIds = [301, 302, 303, 304, 305].map((id) => `servicePage-${id}-chicago`)
const ids = [
  'siteSettings',
  'servicePageTemplate-standard-v1',
  'area-chicago',
  ...[301, 302, 303, 304, 305].map((id) => `service-${id}`),
  ...pageIds,
  ...pageIds.map((id) => `drafts.${id}`),
]

const client = createClient({projectId, dataset, apiVersion: '2026-03-01', token, useCdn: false})

async function main() {
const documents = await client.fetch<Array<{
  _id: string
  _type: string
  _rev: string
  title?: string
  name?: string
  serviceId?: number
  serviceSlug?: string
  areaSlug?: string
  seoTitle?: string
  canonicalUrl?: string
  reviewCount?: number
  trustMetricCount?: number
  guideCount?: number
  galleryCount?: number
  workingPhotoCount?: number
  hasCoverImage?: boolean
  areaPhotoCount?: number
  templateVersion?: string
  hasFormCopy?: boolean
}>>(`*[_id in $ids] | order(_id) {
  _id,
  _type,
  _rev,
  title,
  name,
  serviceId,
  "serviceSlug": service->slug.current,
  "areaSlug": area->slug.current,
  "seoTitle": seo.title,
  "canonicalUrl": seo.canonicalUrl,
  "reviewCount": count(reviews),
  "trustMetricCount": count(trustMetrics),
  "guideCount": count(guides),
  "galleryCount": count(gallery),
  "workingPhotoCount": count(workingPhotos),
  "hasCoverImage": defined(coverImage.image.asset) || defined(coverImage.externalUrl),
  "areaPhotoCount": count(area->subAreas[defined(photo.image.asset) || defined(photo.externalUrl)]),
  "templateVersion": template->version,
  "hasFormCopy": defined(formSubtitle) && defined(formNote)
}`, {ids})

console.log(JSON.stringify({projectId, dataset, requested: ids.length, found: documents.length, documents}, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown Sanity audit error')
  process.exit(1)
})
