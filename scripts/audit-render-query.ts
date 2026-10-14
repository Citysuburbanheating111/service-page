import fs from 'node:fs'
import path from 'node:path'
import {createClient} from 'next-sanity'
import {SERVICE_PAGE_QUERY} from '../src/sanity/lib/queries'

const envPath = path.resolve('.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const separator = trimmed.indexOf('=')
  if (separator < 1) continue
  const key = trimmed.slice(0, separator)
  const value = trimmed.slice(separator + 1).replace(/^['"]|['"]$/g, '')
  if (!process.env[key]) process.env[key] = value
}

const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_AUTH_TOKEN
if (!token) throw new Error('A configured Sanity token is required')
const client = createClient({
  projectId: process.env.NEXT_SANITY_PROJECT_ID || 'boolyxr0',
  dataset: process.env.NEXT_SANITY_DATASET || 'production',
  apiVersion: '2026-03-01',
  token,
  useCdn: false,
  perspective: 'published',
})

const routes = ['water-heater-repair-installation', 'air-conditioner-repair-installation', 'furnace-repair-installation', 'hvac-repair-installation', 'heat-pump-repair-installation']
async function main() {
  const results = []
  for (const serviceSlug of routes) {
    const data = await client.fetch(SERVICE_PAGE_QUERY, {serviceSlug, areaSlug: 'chicago'})
    results.push({
      serviceSlug,
      pageId: data.page?._id,
      gallery: data.page?.gallery?.length || 0,
      workingPhotos: data.page?.workingPhotos?.length || 0,
      areaPhotos: data.page?.area?.subAreas?.filter((area: {photo?: {resolvedUrl?: string}}) => area.photo?.resolvedUrl).length || 0,
      resolvedGallery: data.page?.gallery?.every((image: {resolvedUrl?: string}) => Boolean(image.resolvedUrl)) || false,
    })
  }
  console.log(JSON.stringify(results, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown render-query audit error')
  process.exit(1)
})
